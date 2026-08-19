INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('session-audio', 'session-audio', false, 26214400)
ON CONFLICT (id) DO NOTHING;
