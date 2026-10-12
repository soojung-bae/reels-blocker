import UIKit
import WebKit

/// One persistent web view for a site, with the blocking script injected
/// into every page before the site's own code runs.
final class WebTab: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let site: Site
    let webView: WKWebView
    @Published var canGoBack = false

    private var started = false
    private var backObservation: NSKeyValueObservation?

    init(site: Site) {
        self.site = site

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // stay logged in between launches
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [] // a reel you open just plays
        // Look like mobile Safari so the sites serve their normal mobile pages.
        config.applicationNameForUserAgent = "Version/18.0 Mobile/15E148 Safari/604.1"

        if let url = Bundle.main.url(forResource: site.scriptName, withExtension: "js"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            let script = WKUserScript(source: source,
                                      injectionTime: .atDocumentStart,
                                      forMainFrameOnly: true,
                                      in: .defaultClient) // isolated from the site's own JS
            config.userContentController.addUserScript(script)
        } else {
            assertionFailure("Missing \(site.scriptName).js in the app bundle")
        }

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        backObservation = webView.observe(\.canGoBack, options: [.initial, .new]) { [weak self] webView, _ in
            DispatchQueue.main.async { self?.canGoBack = webView.canGoBack }
        }
    }

    func startIfNeeded() {
        guard !started else { return }
        started = true
        webView.load(URLRequest(url: site.home))
    }

    func load(_ url: URL) {
        started = true
        webView.load(URLRequest(url: url))
    }

    func goHome() { load(site.home) }

    func goBack() { webView.goBack() }

    @objc private func pullToRefresh(_ control: UIRefreshControl) {
        webView.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { control.endRefreshing() }
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView,
                 decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else {
            return decisionHandler(.cancel)
        }

        // instagram://, fb:// etc. would bounce you into the real app.
        guard ["http", "https", "about", "blob", "data"].contains(scheme) else {
            return decisionHandler(.cancel)
        }

        let isMainFrame = action.targetFrame?.isMainFrame ?? true
        if isMainFrame, action.navigationType == .linkActivated,
           let host = url.host?.lowercased(), !Site.isAllowed(host: host) {
            UIApplication.shared.open(url) // outside links go to Safari
            return decisionHandler(.cancel)
        }

        // "Allow without trying app links": keeps instagram.com / facebook.com
        // links inside this app instead of handing them to the real apps.
        let allowWithoutAppLinks = WKNavigationActionPolicy(rawValue: WKNavigationActionPolicy.allow.rawValue + 2)
        decisionHandler(allowWithoutAppLinks ?? .allow)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: WKUIDelegate

    /// Links that want a new window (target=_blank) open in this one.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.targetFrame == nil, let url = action.request.url {
            if let host = url.host?.lowercased(), Site.isAllowed(host: host) {
                webView.load(URLRequest(url: url))
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        present(message: message, cancellable: false) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        present(message: message, cancellable: true, completion: completionHandler)
    }

    private func present(message: String, cancellable: Bool, completion: @escaping (Bool) -> Void) {
        guard let presenter = webView.window?.rootViewController?.topmostPresented else {
            return completion(!cancellable)
        }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        if cancellable {
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completion(false) })
        }
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completion(true) })
        presenter.present(alert, animated: true)
    }
}

private extension UIViewController {
    var topmostPresented: UIViewController {
        presentedViewController?.topmostPresented ?? self
    }
}
