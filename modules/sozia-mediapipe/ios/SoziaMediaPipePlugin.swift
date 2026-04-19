import Foundation
import QuartzCore
import VisionCamera

/// VisionCamera JSI frame processor plugin.
/// Registered as "extractLandmarks" — callable from JS worklets as:
///   const result = extractLandmarks(frame)
@objc(SoziaMediaPipePlugin)
public class SoziaMediaPipePlugin: FrameProcessorPlugin {

  private let holistic = SoziaMediaPipeHolistic()

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      self?.holistic.load()
    }
  }

  public override func callback(_ frame: Frame,
                                withArguments arguments: [AnyHashable: Any]?) -> Any? {
    let ts = Int(CACurrentMediaTime() * 1000)
    guard let result = holistic.detect(sampleBuffer: frame.buffer, timestampMs: ts) else {
      return nil
    }
    return serialize(result, timestampMs: ts)
  }

  // MARK: - Serialization

  private func serialize(_ result: SoziaMediaPipeHolistic.LandmarkResult,
                          timestampMs: Int) -> [String: Any] {
    var dict: [String: Any] = [
      "sessionId": "",
      "timestampMs": timestampMs,
    ]
    dict["faceLandmarks"]      = result.faceLandmarks.map { $0 as Any } as Any
    dict["leftHandLandmarks"]  = result.leftHandLandmarks.map { $0 as Any } as Any
    dict["rightHandLandmarks"] = result.rightHandLandmarks.map { $0 as Any } as Any
    dict["poseLandmarks"]      = result.poseLandmarks.map { $0 as Any } as Any
    return dict
  }
}

// MARK: - Plugin registration

extension SoziaMediaPipePlugin {
  @objc static func load() {
    FrameProcessorPluginRegistry.addPlugin(withName: "extractLandmarks") { proxy, options in
      SoziaMediaPipePlugin(proxy: proxy, options: options)
    }
  }
}
