# frozen_string_literal: true

# Fix audio/video pausing ~0.5s into playback during local development.
#
# Jekyll's WEBrick servlet serves every response as 200 with the full body,
# ignoring HTTP Range headers. Browsers need 206 Partial Content to stream
# media properly. With DevTools Network tab open Chrome caches the full
# response and satisfies Range requests from cache — which is why the bug
# disappears when DevTools is open.
#
# This plugin prepends a module onto Jekyll's Servlet that converts eligible
# 200 responses into proper 206 Partial Content responses.
#
# Only active during `jekyll serve`. GitHub Pages ignores _plugins/.

if defined?(Jekyll::Commands::Serve::Servlet)
  module JekyllRangeRequestFix
    def do_GET(req, res)
      # Strip conditional headers so WEBrick never returns 304 for media.
      # Cached 206 partials + 304 "Not Modified" confuse the audio element.
      req.header.delete("if-none-match")
      req.header.delete("if-modified-since")

      super

      res["Cache-Control"] = "no-store"

      return unless res.status == 200 && req["Range"]
      return unless req["Range"] =~ /\Abytes=(\d*)-(\d*)\z/

      body = res.body
      return unless body

      body = body.is_a?(String) ? body : body.read
      total = body.bytesize
      return if total.zero?

      range_start = Regexp.last_match(1).empty? ? nil : Regexp.last_match(1).to_i
      range_end   = Regexp.last_match(2).empty? ? nil : Regexp.last_match(2).to_i

      if range_start.nil?
        # "bytes=-500" → last 500 bytes
        range_start = [total - (range_end || 0), 0].max
        range_end   = total - 1
      else
        range_end = [range_end || (total - 1), total - 1].min
      end

      return if range_start >= total || range_start > range_end

      res.status           = 206
      res.body             = body.byteslice(range_start, range_end - range_start + 1)
      res["Content-Range"]  = "bytes #{range_start}-#{range_end}/#{total}"
      res["Content-Length"] = res.body.bytesize.to_s
      res["Accept-Ranges"]  = "bytes"
    end
  end

  Jekyll::Commands::Serve::Servlet.prepend(JekyllRangeRequestFix)
end
