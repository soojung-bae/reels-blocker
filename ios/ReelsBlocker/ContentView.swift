import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject private var browser: Browser

    var body: some View {
        VStack(spacing: 0) {
            TopBar(tab: browser.tabs[browser.current]!)
            Divider()
            ZStack {
                // Both sites stay alive so switching doesn't reload them.
                ForEach(Site.allCases) { site in
                    WebViewContainer(webView: browser.tabs[site]!.webView)
                        .opacity(browser.current == site ? 1 : 0)
                        .allowsHitTesting(browser.current == site)
                }
            }
        }
    }
}

private struct TopBar: View {
    @EnvironmentObject private var browser: Browser
    @ObservedObject var tab: WebTab

    var body: some View {
        HStack(spacing: 12) {
            Button(action: tab.goBack) {
                Image(systemName: "chevron.left")
            }
            .disabled(!tab.canGoBack)
            .accessibilityLabel("Back")

            Picker("Site", selection: $browser.current) {
                ForEach(Site.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)

            // Paste a copied reel/post link (e.g. from Messenger) to open just that one.
            PasteButton(payloadType: String.self) { strings in
                DispatchQueue.main.async { strings.first.map(browser.openPasted) }
            }
            .labelStyle(.iconOnly)
            .buttonBorderShape(.capsule)

            Button(action: tab.goHome) {
                Image(systemName: "house")
            }
            .accessibilityLabel("Home")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }
}

private struct WebViewContainer: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
