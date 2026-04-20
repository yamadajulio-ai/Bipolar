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
        let dynamic = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 13.0/255.0, green: 13.0/255.0, blue: 15.0/255.0, alpha: 1.0)
                : .white
        }
        view.backgroundColor = dynamic
        if let webView = self.webView {
            webView.isOpaque = false
            webView.backgroundColor = dynamic
            webView.scrollView.backgroundColor = dynamic
        }
    }
}
