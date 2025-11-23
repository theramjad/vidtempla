import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/component';

interface AuthState {
  // Data
  user: User | null;
  session: Session | null;

  // Loading state - only true on initial app load
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setInitialized: (initialized: boolean) => void;
  initialize: () => void;
  signOut: () => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  user: null,
  session: null,
  isInitialized: false,
};

// Track if auth listener has been initialized
let isListenerInitialized = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setSession: (session) => set({ session }),

      setInitialized: (initialized) => set({ isInitialized: initialized }),

      initialize: () => {
        // Only initialize once
        if (isListenerInitialized) return () => {};
        isListenerInitialized = true;

        const supabase = createClient();

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
          set({
            session,
            user: session?.user ?? null,
            isInitialized: true
          });
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            set({
              session,
              user: session?.user ?? null,
              isInitialized: true
            });
          }
        );

        // Cleanup subscription on unmount
        return () => {
          subscription.unsubscribe();
          isListenerInitialized = false;
        };
      },

      signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        set({ user: null, session: null });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'auth-storage',
      // Only persist user data, not initialization state
      partialize: (state) => ({
        user: state.user,
        session: state.session,
      }),
    }
  )
);
