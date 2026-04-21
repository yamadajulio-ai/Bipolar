import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        applyDynamicBackground()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        applyDynamicBackground()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyDynamicBackground()
    }

    private func applyDynamicBackground() {
        // Cores alinhadas com tokens CSS (src/app/globals.css) E splash PNGs:
        //   light  → #f6f3ee (cream, --background root)
        //   dark   → #171411 (--background em .dark)
        // Splash PNGs + CSS body + WebView precisam bater pra não piscar na transição.
        let dynamic = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 23.0/255.0, green: 20.0/255.0, blue: 17.0/255.0, alpha: 1.0)
                : UIColor(red: 246.0/255.0, green: 243.0/255.0, blue: 238.0/255.0, alpha: 1.0)
        }
        view.backgroundColor = dynamic
        if let webView = self.webView {
            webView.isOpaque = false
            webView.backgroundColor = dynamic
            webView.scrollView.backgroundColor = dynamic
        }
    }
}
