# frozen_string_literal: true

# DevInsight SDK for Ruby
#
# Captures unhandled exceptions and reports them to DevInsight.
#
# Usage:
#   require_relative 'devinsight'  # só isso
#
# Configuration (env vars):
#   DEVINSIGHT_API_KEY   — your API key
#   DEVINSIGHT_BASE_URL  — base URL (default: https://devinsight-api.onrender.com)
#   DEVINSIGHT_PROJECT   — project name (default: unknown)
#   DEVINSIGHT_ENABLED=0 — disable SDK

require 'net/http'
require 'json'
require 'uri'

module Devinsight
  API_KEY  = ENV.fetch('DEVINSIGHT_API_KEY', '').freeze
  BASE_URL = ENV.fetch('DEVINSIGHT_BASE_URL', 'https://devinsight-api.onrender.com').chomp('/').freeze
  PROJECT  = ENV.fetch('DEVINSIGHT_PROJECT', 'unknown').freeze
  ENABLED  = ENV['DEVINSIGHT_ENABLED'] != '0'

  def self.send_diagnostic(message, exception_type, stack)
    return unless ENABLED && !API_KEY.empty?

    payload = JSON.generate(
      tipo: 'silent_backend_error',
      mensagem: message.to_s,
      contexto: {
        project_name:   PROJECT,
        exception_type: exception_type.to_s,
        stack:          stack.to_s
      }
    )

    uri  = URI("#{BASE_URL}/v1/diagnosticos")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl     = uri.scheme == 'https'
    http.open_timeout = 10
    http.read_timeout = 10

    req = Net::HTTP::Post.new(uri.path.empty? ? '/' : uri.path)
    req['Content-Type']  = 'application/json'
    req['Authorization'] = "Bearer #{API_KEY}"
    req.body = payload

    http.request(req)
  rescue StandardError => e
    warn "[DevInsight] Falha ao enviar diagnóstico: #{e.message}"
  end

  # Register at_exit hook — $! holds the exception on unhandled crash in MRI Ruby 2.7+/3.x
  if ENABLED && !API_KEY.empty?
    at_exit do
      err = $!
      next if err.nil? || err.is_a?(SystemExit)

      Devinsight.send_diagnostic(
        err.message,
        err.class.name,
        err.backtrace&.join("\n") || ''
      )
    end
  end
end
