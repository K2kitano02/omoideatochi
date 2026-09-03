type EnvValues = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
};

type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export const createEnv = (values: EnvValues): Env => {
  const missingVariables = [
    ['EXPO_PUBLIC_SUPABASE_URL', values.supabaseUrl],
    ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', values.supabasePublishableKey],
  ]
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  return {
    supabaseUrl: values.supabaseUrl!.trim(),
    supabasePublishableKey: values.supabasePublishableKey!.trim(),
  };
};

export const getEnv = (): Env =>
  createEnv({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
