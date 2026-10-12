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

    var home: URL {
        switch self {
        case .instagram: return URL(string: "https://www.instagram.com/")!
        case .facebook: return URL(string: "https://m.facebook.com/")!
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
        let extra = ["facebook.net", "fbcdn.net", "fbsbx.com", "cdninstagram.com", "meta.com", "messenger.com"]
        return forURL(URL(string: "https://\(host)")!) != nil
            || extra.contains { host == $0 || host.hasSuffix("." + $0) }
    }
}
