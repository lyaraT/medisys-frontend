import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useMemo,
  useEffect,
} from "react";
import { User, UserRole } from "../types";

// ===== Cognito Hosted UI config =====
const COGNITO_DOMAIN =
  "us-east-1yui7wwdxt.auth.us-east-1.amazoncognito.com"; // Confirm your domain
const COGNITO_CLIENT_ID = "3811roiq7vloo7q2si1nrpgs0d"; // Confirm client ID

// Dynamically pick redirect based on environment
const ORIGIN_WITH_SLASH = `${window.location.origin.replace(/\/+$/, "")}/`;

const COGNITO_REDIRECT_URI = ORIGIN_WITH_SLASH;
const COGNITO_LOGOUT_URI = ORIGIN_WITH_SLASH;

const TOKEN_STORAGE_KEY = "cognito_id_token";

interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Base64URL -> JSON helper for JWT payloads
function decodeJwtPayload<T = any>(jwt: string): T {
  const base64Url = jwt.split(".")[1];
  if (!base64Url) throw new Error("Invalid JWT");

  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  const json = atob(padded);
  return JSON.parse(json) as T;
}

const parseToken = (idToken: string): User | null => {
  try {
    const decodedPayload: any = decodeJwtPayload(idToken);

    if (decodedPayload.exp * 1000 < Date.now()) {
      console.warn("Cognito token is expired.");
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }

    const groups: string[] = decodedPayload["cognito:groups"] || [];
    const has = (g: string) => groups.includes(g);

    let role = UserRole.CLINIC;
    if (has("MedisysAdmin") || has("MedSysAdmin") || has("Admin")) {
      role = UserRole.ADMIN;
    } else if (has("MedisysStaff") || has("MedSysStaff") || has("Staff")) {
      role = UserRole.STAFF;
    } else if (has("ClinicStaff") || has("ClinicUser")) {
      role = UserRole.CLINIC;
    }

    const cognitoUser: User = {
      id: decodedPayload.sub,
      name:
        decodedPayload.name ||
        decodedPayload["cognito:username"] ||
        decodedPayload.email ||
        "N/A",
      email: decodedPayload.email,
      role,
      clinicId: decodedPayload["custom:clinicId"],
      clinicName: decodedPayload["custom:clinicName"],
    };
    return cognitoUser;
  } catch (error) {
    console.error("Error parsing Cognito token:", error);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      const sessionUser = parseToken(storedToken);
      if (sessionUser) {
        setUser(sessionUser);
        setLoading(false);
        return;
      }
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (hash) {
      const params = new URLSearchParams(hash);
      const idToken = params.get("id_token");

      if (idToken) {
        const cognitoUser = parseToken(idToken);
        if (cognitoUser) {
          localStorage.setItem(TOKEN_STORAGE_KEY, idToken);
          setUser(cognitoUser);
        }
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }
    }

    setLoading(false);
  }, []);

  const login = () => {
    setLoading(true);
    const scopes = encodeURIComponent("openid profile email");
    const authUrl = `https://${COGNITO_DOMAIN}/login?client_id=${encodeURIComponent(
      COGNITO_CLIENT_ID
    )}&response_type=token&scope=${scopes}&redirect_uri=${encodeURIComponent(
      COGNITO_REDIRECT_URI
    )}`;
    window.location.href = authUrl;
  };

  const logout = () => {
    setLoading(true);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    const logoutUrl = `https://${COGNITO_DOMAIN}/logout?client_id=${encodeURIComponent(
      COGNITO_CLIENT_ID
    )}&logout_uri=${encodeURIComponent(COGNITO_LOGOUT_URI)}`;
    window.location.href = logoutUrl;
  };

  const value = useMemo(
    () => ({ user, login, logout, loading }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
