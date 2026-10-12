import Foundation

enum Site: String, CaseIterable, Identifiable {
    case instagram
    case facebook

    var id: String { rawValue }

    var title: String {
        switch self {
        case .instagram: return "Instagram"
        case .facebook: return "Facebook"
        }
    }

    /// Opens straight on the Following / Friends feed, saving the script a
    /// redirect (and a second page load) at launch.
    var home: URL {
        switch self {
        case .instagram: return URL(string: "https://www.instagram.com/?variant=following")!
        case .facebook: return URL(string: "https://m.facebook.com/?filter=friends&sk=h_chr")!
        }
    }

    /// Blocking script bundled in Scripts/ (shared with the Node tests).
    var scriptName: String { "\(rawValue).user" }

    private var hosts: [String] {
        switch self {
        case .instagram: return ["instagram.com", "instagr.am"]
        case .facebook: return ["facebook.com", "fb.com", "fb.watch", "fb.me"]
        }
    }

    func owns(host: String) -> Bool {
        hosts.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    static func forURL(_ url: URL) -> Site? {
        guard let host = url.host?.lowercased() else { return nil }
        return allCases.first { $0.owns(host: host) }
    }

    /// Hosts that may load inside the app (logins, CDNs, Meta account pages).
    /// Links to anything else open in Safari.
    static func isAllowed(host: String) -> Bool {
        allowedHosts.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    private static let allowedHosts = allCases.flatMap(\.hosts)
        + ["facebook.net", "fbcdn.net", "fbsbx.com", "cdninstagram.com", "meta.com", "messenger.com"]
}
