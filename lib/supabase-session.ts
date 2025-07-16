import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'wa-auth';
const FOLDER = 'botwa/'; // folder di bucket
const LOCAL = '/tmp/botwa'; // folder lokal untuk session

export async function downloadSessionFromSupabase() {
  if (!fs.existsSync(LOCAL)) fs.mkdirSync(LOCAL, { recursive: true });
  const { data: list, error } = await supabase
    .storage
    .from(BUCKET)
    .list(FOLDER);
  if (error) throw error;
  if (!list) return;
  for (const f of list) {
    const { data: blob, error: err2 } = await supabase
      .storage
      .from(BUCKET)
      .download(`${FOLDER}${f.name}`);
    if (err2) throw err2;
    const buf = Buffer.from(await blob!.arrayBuffer());
    fs.writeFileSync(path.join(LOCAL, f.name), buf);
  }
}

export async function uploadSessionToSupabase() {
  const files = fs.readdirSync(LOCAL);
  for (const name of files) {
    const buf = fs.readFileSync(path.join(LOCAL, name));
    await supabase
      .storage
      .from(BUCKET)
      .upload(`${FOLDER}${name}`, buf, { upsert: true });
  }
} 