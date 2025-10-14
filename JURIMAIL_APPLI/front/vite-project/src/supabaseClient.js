// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://otgqdmkckhihxeycyrbj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90Z3FkbWtja2hpaHhleWN5cmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDgyODIsImV4cCI6MjA2MjEyNDI4Mn0.5rdEF2D87G6x97rsULeAU_hSVrPrGYs6bUVu1LdGJA4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
