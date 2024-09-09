// supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zhmjbteiremuhyelwbar.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobWpidGVpcmVtdWh5ZWx3YmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ5MTczNTAsImV4cCI6MjA0MDQ5MzM1MH0.g6z3K8LOcy1XgRnTdzASzu1hB1VQUJKVj9uRq-X3mlk";

export const supabase = createClient(supabaseUrl, supabaseKey);
