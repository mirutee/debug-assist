# frozen_string_literal: true

Gem::Specification.new do |s|
  s.name        = 'debug-assist'
  s.version     = '1.0.0'
  s.summary     = 'Auto-capture runtime errors and send diagnostics to DebugAssist API'
  s.description = 'DebugAssist SDK for Ruby — captures unhandled exceptions and reports them to DebugAssist for diagnosis.'
  s.authors     = ['DebugAssist']
  s.email       = 'hi@debug-assist.app'
  s.files       = ['lib/debug_assist.rb']
  s.homepage    = 'https://github.com/debug-assist/sdk-ruby'
  s.license     = 'MIT'
  s.required_ruby_version = '>= 2.7'
end
