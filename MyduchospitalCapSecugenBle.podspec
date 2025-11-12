require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'MyduchospitalCapSecugenBle'
  s.version          = package['version']
  s.summary          = package['description'] || 'Capacitor plugin for SecuGen BLE fingerprint scanner'
  s.license          = package['license']
  s.homepage         = package['repository']['url'] || package['homepage']
  s.author           = package['author']
  s.source           = { :git => package['repository']['url'], :tag => s.version.to_s }
  s.source_files     = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target  = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
  
  # Static library
  s.vendored_libraries = 'ios/Plugin/libFMSProtocol.a'
  
  # Framework search paths
  s.xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited)',
    'LIBRARY_SEARCH_PATHS' => '$(inherited) $(SRCROOT)/../node_modules/@myduchospital/cap-secugen-ble/ios/Plugin'
  }
end
# require 'json'

# package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

# Pod::Spec.new do |s|
#   s.name = 'MyduchospitalCapSecugenBle'
#   s.version = package['version']
#   s.summary = package['description']
#   s.license = package['license']
#   s.homepage = package['repository']['url']
#   s.author = package['author']
#   s.source = { :git => package['repository']['url'], :tag => s.version.to_s }
#   s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
#   s.ios.deployment_target  = '13.0'
#   s.dependency 'Capacitor'
#   s.swift_version = '5.1'

#   # Basic frameworks only - clean setup like the example
#   s.ios.frameworks = 'CoreBluetooth', 'Foundation'
#   s.requires_arc = true
# end
