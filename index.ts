import { registerRootComponent } from 'expo';

import App from './App';
import { getSupabaseClient } from './src/lib/supabase';
import { initializeSupabaseAuthLifecycle } from './src/lib/supabaseAuthLifecycle';

const supabase = getSupabaseClient();

initializeSupabaseAuthLifecycle(supabase.auth);

registerRootComponent(App);
