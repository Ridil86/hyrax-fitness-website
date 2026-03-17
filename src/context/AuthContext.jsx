import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  signInWithRedirect,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin = groups.includes('Admin');

  // Extract groups from the Cognito access token
  const extractGroups = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const payload = session.tokens?.accessToken?.payload;
      return payload?.['cognito:groups'] || [];
    } catch {
      return [];
    }
  }, []);

  // Refresh user state after sign-in (used by both direct and OAuth flows)
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const userGroups = await extractGroups();
      setGroups(userGroups);
    } catch {
      setUser(null);
      setGroups([]);
    }
  }, [extractGroups]);

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      try {
        await refreshUser();
      } catch {
        // Not signed in
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshUser]);

  // Listen for OAuth redirect completion (Google sign-in)
  useEffect(() => {
    const unsubscribe = Hub.listen('auth', async ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        // OAuth redirect completed successfully
        await refreshUser();
        setLoading(false);
      }
      if (payload.event === 'signInWithRedirect_failure') {
        console.error('OAuth redirect failed:', payload.data);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [refreshUser]);

  const signIn = async (email, password) => {
    const result = await amplifySignIn({ username: email, password });
    if (result.isSignedIn) {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const userGroups = await extractGroups();
      setGroups(userGroups);
    }
    return result;
  };

  const signUp = async ({ email, password, givenName, familyName }) => {
    const result = await amplifySignUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          given_name: givenName,
          family_name: familyName,
        },
      },
    });
    return result;
  };

  const confirmSignUp = async (email, code) => {
    const result = await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    return result;
  };

  const signOut = async () => {
    await amplifySignOut();
    setUser(null);
    setGroups([]);
  };

  // Sign in with Google via Cognito Hosted UI redirect
  const signInWithGoogle = () => {
    signInWithRedirect({ provider: 'Google' });
  };

  // Get the current ID token for API Authorization header
  const getIdToken = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  }, []);

  const value = {
    user,
    groups,
    isAuthenticated,
    isAdmin,
    loading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    signInWithGoogle,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
