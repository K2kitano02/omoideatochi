import { registerRootComponent } from 'expo';

import App from './App';
import { getSupabaseClient } from './src/lib/supabase';
import { createSupabaseAuthLifecycle } from './src/lib/supabaseAuthLifecycle';

const supabase = getSupabaseClient();
const supabaseAuthLifecycle = createSupabaseAuthLifecycle(supabase.auth);

supabaseAuthLifecycle.start();

registerRootComponent(App);
