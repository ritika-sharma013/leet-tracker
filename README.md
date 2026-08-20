# LeetCode Progress Tracker

1. Open `config.js` and replace `supabaseUrl` and `supabaseAnonKey`.
2. Create the `leetcode_stats` table with these columns:
   - `problem_title` text
   - `difficulty` text
   - `runtime_ms` numeric
   - `memory_mb` numeric
   - `submitted_at` timestamptz
   - `source_url` text
3. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder.
4. Submit a solution on LeetCode. Inspect the extension's service-worker console if a request fails.

The extension prefers LeetCode GraphQL submission responses and falls back to the visible result DOM. The background worker sends the Supabase REST request so the API key is not exposed to the page context.
