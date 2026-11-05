Pod::Spec.new do |s|
  s.name           = 'KimiWidget'
  s.version        = '1.0.0'
  s.summary        = 'Storage shared with the Kimi home-screen widgets (App Group) and widget reloads.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Kimi'
  s.homepage       = 'https://kimi.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit', 'ActivityKit'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
