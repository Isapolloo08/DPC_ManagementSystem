import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Ministry } from "../types";
import { api } from "../api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  demoUsers: User[];
  ministries: Ministry[];
  allowedMinistries: Ministry[];
  isRestricted: boolean;
  isCoordinator: boolean;
  hasUsers: boolean;
  selectedMinistryId: number | null; // null = Church-Wide
  setSelectedMinistryId: (id: number | null) => void;
  login: (emailOrUsername: string, password?: string) => Promise<void>;
  register: (data: { name: string; username?: string; email: string; password: string; role_id?: number }) => Promise<{ isFirstUser: boolean }>;
  switchDemoUser: (userId: number) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("chms_token"));
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [hasUsers, setHasUsers] = useState<boolean>(true);
  const [selectedMinistryId, setSelectedMinistryId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchInitial = async () => {
    try {
      setLoading(true);
      const [demoList, minList, status] = await Promise.all([
        api.getDemoUsers().catch(() => []),
        api.getMinistries().catch(() => []),
        api.getSetupStatus().catch(() => ({ hasUsers: true, totalUsers: 1, isFirstUser: false }))
      ]);
      setDemoUsers(demoList);
      setMinistries(minList);
      setHasUsers(status.hasUsers);

      const savedToken = localStorage.getItem("chms_token");
      if (savedToken) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          if (res.user.ministries && res.user.ministries.length > 0 && res.user.role_name !== "Admin") {
            setSelectedMinistryId(res.user.ministries[0].id);
          } else {
            setSelectedMinistryId(null);
          }
        } catch {
          localStorage.removeItem("chms_token");
          setToken(null);
          setUser(null);
        }
      }
    } catch (err) {
      console.error("Auth init failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  useEffect(() => {
    if (user && user.ministries && user.ministries.length > 0 && user.role_name !== "Admin") {
      setSelectedMinistryId(user.ministries[0].id);
    }
  }, [user?.id, user?.role_name]);

  const login = async (emailOrUsername: string, password = "password123") => {
    const res = await api.login(emailOrUsername, password);
    localStorage.setItem("chms_token", res.token);
    setToken(res.token);
    setUser(res.user);
    if (res.user.ministries.length > 0 && res.user.role_name !== "Admin") {
      setSelectedMinistryId(res.user.ministries[0].id);
    } else {
      setSelectedMinistryId(null);
    }
  };

  const register = async (data: { name: string; username?: string; email: string; password: string; role_id?: number }) => {
    const res = await api.register(data);
    localStorage.setItem("chms_token", res.token);
    setToken(res.token);
    setUser(res.user);
    setHasUsers(true);
    if (res.user.ministries.length > 0 && res.user.role_name !== "Admin") {
      setSelectedMinistryId(res.user.ministries[0].id);
    } else {
      setSelectedMinistryId(null);
    }
    // Refresh demo list in background
    api.getDemoUsers().then(setDemoUsers).catch(() => {});
    return { isFirstUser: res.isFirstUser };
  };

  const switchDemoUser = async (userId: number) => {
    try {
      const res = await api.switchDemo(userId);
      localStorage.setItem("chms_token", res.token);
      setToken(res.token);
      setUser(res.user);
      if (res.user.ministries.length > 0 && res.user.role_name !== "Admin") {
        setSelectedMinistryId(res.user.ministries[0].id);
      } else {
        setSelectedMinistryId(null);
      }
    } catch (err) {
      console.error("Demo switch failed:", err);
      throw err;
    }
  };

  const refreshUserData = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
      if (res.user.ministries && res.user.ministries.length > 0 && res.user.role_name !== "Admin") {
        setSelectedMinistryId(res.user.ministries[0].id);
      } else {
        setSelectedMinistryId(null);
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  };

  const refreshAuthStatus = async () => {
    try {
      const [demoList, status] = await Promise.all([
        api.getDemoUsers().catch(() => []),
        api.getSetupStatus().catch(() => ({ hasUsers: true, totalUsers: 1, isFirstUser: false }))
      ]);
      setDemoUsers(demoList);
      setHasUsers(status.hasUsers);
    } catch (err) {
      console.error("Failed to refresh auth status:", err);
    }
  };

  const isCoordinator = user?.role_name === "Coordinator" || user?.role_name === "Volunteer";
  const isRestricted = Boolean(user && user.role_name !== "Admin" && user.ministries && user.ministries.length > 0);

  const allowedMinistries = React.useMemo(() => {
    if (!isRestricted || !user?.ministries || user.ministries.length === 0) {
      return ministries;
    }
    const assignedIds = new Set(user.ministries.map((m) => m.id));
    const filtered = ministries.filter((m) => assignedIds.has(m.id));
    return filtered.length > 0 ? filtered : ministries;
  }, [user, ministries, isRestricted]);

  const logout = () => {
    localStorage.removeItem("chms_token");
    setToken(null);
    setUser(null);
    setSelectedMinistryId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        demoUsers,
        ministries,
        allowedMinistries,
        isRestricted,
        isCoordinator,
        hasUsers,
        selectedMinistryId,
        setSelectedMinistryId,
        login,
        register,
        switchDemoUser,
        logout,
        loading,
        refreshUserData,
        refreshAuthStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
