Pod::Spec.new do |s|
  s.name         = "sozia-mediapipe"
  s.version      = "1.0.0"
  s.summary      = "MediaPipe landmark frame processor plugin for Sozia"
  s.homepage     = "https://github.com/sozia"
  s.license      = "MIT"
  s.authors      = { "Sozia" => "dev@sozia.app" }
  s.platforms    = { :ios => "15.4" }
  s.source       = { :path => "." }
  s.source_files = "ios/**/*.{swift,h,m}"
  s.dependency "VisionCamera"
  s.dependency "mediapipe_tasks_vision", "~> 0.10"
  s.swift_version = "5.9"
end
