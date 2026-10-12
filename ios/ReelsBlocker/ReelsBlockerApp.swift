import SwiftUI

@main
struct ReelsBlockerApp: App {
    @StateObject private var browser = Browser()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(browser)
                .onOpenURL { browser.handle($0) }
        }
    }
}
