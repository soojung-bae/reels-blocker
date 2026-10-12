import Foundation

/// Holds one web view per site and routes incoming links to the right one.
final class Browser: ObservableObject {
    @Published var current: Site = .instagram {
        didSet { tabs[current]?.startIfNeeded() }
    }

    let tabs: [Site: WebTab]

    init() {
        tabs = Dictionary(uniqueKeysWithValues: Site.allCases.map { ($0, WebTab(site: $0)) })
        tabs[current]?.startIfNeeded()
    }

    /// reelsblocker://instagram, reelsblocker://facebook,
    /// reelsblocker://open?url=<instagram or facebook link>, or a plain https link.
    func handle(_ url: URL) {
        if url.scheme == "reelsblocker" {
            if let host = url.host, let site = Site(rawValue: host) {
                current = site
            } else if url.host == "open",
                      let target = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                          .queryItems?.first(where: { $0.name == "url" })?.value,
                      let link = URL(string: target) {
                open(link)
            }
        } else {
            open(url)
        }
    }

    /// Opens an Instagram/Facebook link as a fresh page load, so a single
    /// shared reel is allowed (scrolling on from it is still blocked).
    @discardableResult
    func open(_ url: URL) -> Bool {
        guard let site = Site.forURL(url) else { return false }
        current = site
        tabs[site]?.load(url)
        return true
    }

    /// Finds the first link in pasted text and opens it.
    func openPasted(_ text: String) {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..., in: text)
        let links = detector?.matches(in: text, range: range).compactMap(\.url) ?? []
        if let link = links.first(where: { Site.forURL($0) != nil }) {
            open(link)
        }
    }
}
