import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  initializing: boolean;
  onboardingCompleted: boolean | null; // null = pas encore vérifié
  refreshOnboardingStatus: () => Promise<void>;
  signUp: (params: { firstName: string; email: string; password: string }) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (params: { email: string; password: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  const checkOnboardingStatus = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle();
    setOnboardingCompleted(data?.onboarding_completed ?? false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await checkOnboardingStatus(data.session.user.id);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await checkOnboardingStatus(newSession.user.id);
      } else {
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const refreshOnboardingStatus = async () => {
    if (session) await checkOnboardingStatus(session.user.id);
  };

  const signUp: AuthContextValue['signUp'] = async ({ firstName, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName } },
    });
    if (error) return { error: translateAuthError(error.message), needsEmailConfirmation: false };
    return { error: null, needsEmailConfirmation: !data.session };
  };

  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, initializing, onboardingCompleted, refreshOnboardingStatus, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>');
  return ctx;
}

function translateAuthError(message: string): string {
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
  if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (message.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (message.includes('Unable to validate email address')) return 'Adresse email invalide.';
  return message;
}
