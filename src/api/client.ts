// src/api/client.ts
// Local MongoDB Adapter for Optimus (Supabase-compatible API drop-in replacement)

export interface QueryResult<T = any> {
  data: T | null;
  error: any | null;
  count?: number;
}

export class MongoQueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private collection: string;
  private filters: Record<string, any> = {};
  private sortField: string | null = null;
  private sortOrder: "asc" | "desc" = "asc";
  private limitCount: number | null = null;
  private isSingle = false;
  private selectColumns = "*";
  private countMode: string | null = null;
  private isHead = false;
  private pendingAction: "select" | "update" | "delete" | "insert" = "select";
  private pendingData: any = null;

  constructor(collection: string) {
    this.collection = collection;
  }

  select(columns = "*", options: { count?: string; head?: boolean } = {}) {
    this.selectColumns = columns;
    if (options.count) this.countMode = options.count;
    if (options.head) this.isHead = true;
    return this;
  }

  eq(field: string, value: any) {
    this.filters[field] = value;
    return this;
  }

  neq(field: string, value: any) {
    this.filters[field] = { $ne: value };
    return this;
  }

  gt(field: string, value: any) {
    this.filters[field] = { $gt: value };
    return this;
  }

  gte(field: string, value: any) {
    this.filters[field] = { $gte: value };
    return this;
  }

  lt(field: string, value: any) {
    this.filters[field] = { $lt: value };
    return this;
  }

  lte(field: string, value: any) {
    this.filters[field] = { $lte: value };
    return this;
  }

  in(field: string, values: any[]) {
    this.filters[field] = { $in: values };
    return this;
  }

  like(field: string, pattern: string) {
    const regex = String(pattern).replace(/%/g, ".*");
    this.filters[field] = { $regex: regex, $options: "i" };
    return this;
  }

  ilike(field: string, pattern: string) {
    return this.like(field, pattern);
  }

  order(field: string, options: { ascending?: boolean } = { ascending: true }) {
    this.sortField = field;
    this.sortOrder = options.ascending ? "asc" : "desc";
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  returns<ResultType = any>(): MongoQueryBuilder<ResultType> {
    return this as unknown as MongoQueryBuilder<ResultType>;
  }

  insert(data: any) {
    this.pendingAction = "insert";
    this.pendingData = data;
    return this;
  }

  upsert(data: any) {
    return this.insert(data);
  }

  update(data: any) {
    this.pendingAction = "update";
    this.pendingData = data;
    return this;
  }

  delete() {
    this.pendingAction = "delete";
    return this;
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

      if (this.pendingAction === "insert") {
        const payload = Array.isArray(this.pendingData)
          ? this.pendingData.map((d: any) => {
              const c = { ...d };
              delete c._id;
              return c;
            })
          : (() => {
              const c = { ...this.pendingData };
              delete c._id;
              return c;
            })();

        const res = await fetch(`${baseUrl}/api/db/${this.collection}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let json: any = {};
        try {
          json = await res.json();
        } catch {
          json = { error: { message: `Server returned HTTP ${res.status}` } };
        }

        if (!res.ok) {
          const errMsg = json?.error?.message || `Insert failed with HTTP ${res.status}`;
          return { data: null, error: { message: errMsg } };
        }

        let result = json.data || null;
        if (this.isSingle && Array.isArray(result)) {
          result = result.length > 0 ? result[0] : null;
        }
        return { data: result, error: json.error || null };
      }

      if (this.pendingAction === "update") {
        const updateData = { ...this.pendingData };
        delete updateData._id; // Ensure _id is never sent in $set payload

        const res = await fetch(`${baseUrl}/api/db/${this.collection}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: this.filters,
            update: updateData,
          }),
        });

        let json: any = {};
        try {
          json = await res.json();
        } catch {
          json = { error: { message: `Server returned HTTP ${res.status}` } };
        }

        if (!res.ok) {
          const errMsg = json?.error?.message || `Update failed with HTTP ${res.status}`;
          return { data: null, error: { message: errMsg } };
        }

        let result = json.data || null;
        if (this.isSingle && Array.isArray(result)) {
          result = result.length > 0 ? result[0] : null;
        }
        return { data: result, error: json.error || null };
      }

      if (this.pendingAction === "delete") {
        const queryParams = new URLSearchParams({
          filter: JSON.stringify(this.filters),
        });
        const res = await fetch(`${baseUrl}/api/db/${this.collection}?${queryParams.toString()}`, {
          method: "DELETE",
        });

        let json: any = {};
        try {
          json = await res.json();
        } catch {
          json = { error: { message: `Server returned HTTP ${res.status}` } };
        }

        if (!res.ok) {
          const errMsg = json?.error?.message || `Delete failed with HTTP ${res.status}`;
          return { data: null, error: { message: errMsg } };
        }

        return { data: json.data || null, error: json.error || null };
      }

      // SELECT
      const params = new URLSearchParams();
      if (Object.keys(this.filters).length > 0) {
        params.set("filter", JSON.stringify(this.filters));
      }
      if (this.sortField) {
        params.set("sort", this.sortField);
        params.set("order", this.sortOrder);
      }
      if (this.limitCount) {
        params.set("limit", String(this.limitCount));
      }
      if (this.isSingle) {
        params.set("single", "true");
      }
      if (this.countMode) {
        params.set("count", this.countMode);
      }
      if (this.isHead) {
        params.set("head", "true");
      }
      if (this.selectColumns) {
        params.set("select", this.selectColumns);
      }

      const res = await fetch(`${baseUrl}/api/db/${this.collection}?${params.toString()}`);

      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = { error: { message: `Server returned HTTP ${res.status}` } };
      }

      if (!res.ok) {
        const errMsg = json?.error?.message || `Query failed with HTTP ${res.status}`;
        return { data: null, error: { message: errMsg }, count: 0 };
      }

      return {
        data: json.data !== undefined ? json.data : null,
        error: json.error || null,
        count: json.count !== undefined ? json.count : (Array.isArray(json.data) ? json.data.length : 0),
      };
    } catch (err: any) {
      console.error(`MongoDB client query error on [${this.collection}]:`, err);
      const msg = err?.message || String(err) || "Client network error";
      return { data: null, error: { message: msg }, count: 0 };
    }
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Global Auth event bus
const authListeners = new Set<(event: string, session: any) => void>();
function notifyAuthChange(event: string, session: any) {
  authListeners.forEach((callback) => {
    try {
      callback(event, session);
    } catch (e) {
      console.error("Auth listener error:", e);
    }
  });
}

function getStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("optimus_auth_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredSession(session: any) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem("optimus_auth_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("optimus_auth_session");
    }
  } catch (e) {
    console.error("Failed to persist session:", e);
  }
}

const auth = {
  async getSession() {
    const session = getStoredSession();
    return { data: { session }, error: null };
  },

  async getUser() {
    const session = getStoredSession();
    return { data: { user: session?.user || null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const res = await fetch(`${baseUrl}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { data: { user: null, session: null }, error: json.error || { message: "Invalid credentials" } };
      }

      setStoredSession(json.data.session);
      notifyAuthChange("SIGNED_IN", json.data.session);
      return { data: json.data, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  },

  async signUp({ email, password, options = {} }: { email: string; password: string; options?: any }) {
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, options }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { data: { user: null, session: null }, error: json.error || { message: "Signup failed" } };
      }

      setStoredSession(json.data.session);
      notifyAuthChange("SIGNED_IN", json.data.session);
      return { data: json.data, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  },

  async signInWithOAuth({ provider = "google", options = {} as any }: { provider?: string; options?: any } = {}): Promise<{ data: { provider: string; url: string | null }; error: { message: string } | null }> {
    let email = "aerospacebombay1@gmail.com";
    if (typeof window !== "undefined") {
      const input = window.prompt("Sign in with Google Account:", email);
      if (input === null) {
        // User clicked cancel
        return { data: { provider, url: null }, error: null };
      }
      if (input.trim()) {
        email = input.trim();
      }
    }

    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const res = await fetch(`${baseUrl}/api/auth/oauth-google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { data: { provider, url: null }, error: json.error || { message: "Google sign-in failed" } };
      }

      const session = json.data.session;
      setStoredSession(session);
      notifyAuthChange("SIGNED_IN", session);

      if (typeof window !== "undefined" && options?.redirectTo) {
        window.location.href = options.redirectTo;
      }
      return { data: { provider, url: null }, error: null };
    } catch (err: any) {
      console.error("Google OAuth Error:", err);
      return { data: { provider, url: null }, error: { message: err?.message || "Failed to authenticate with Google" } };
    }
  },

  async signOut(): Promise<{ error: { message: string } | null }> {
    setStoredSession(null);
    notifyAuthChange("SIGNED_OUT", null);
    return { error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    authListeners.add(callback);
    const current = getStoredSession();
    setTimeout(() => callback(current ? "SIGNED_IN" : "INITIAL_SESSION", current), 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(callback);
          },
        },
      },
    };
  },

  async updateUser({ password }: { password?: string }): Promise<{ data: { user: any }; error: { message: string } | null }> {
    const session = getStoredSession();
    if (session?.user?.id) {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      await fetch(`${baseUrl}/api/auth/update-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.user.id, password }),
      });
    }
    return { data: { user: session?.user || null }, error: null };
  },

  async resetPasswordForEmail(email: string, options?: any): Promise<{ data: any; error: { message: string } | null }> {
    return { data: {}, error: null };
  },
};

const storage = {
  from(bucket: string) {
    return {
      async upload(filePath: string, file: any, options?: any) {
        try {
          const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
          const formData = new FormData();
          formData.append("file", file);
          formData.append("path", filePath);

          const res = await fetch(`${baseUrl}/api/storage/${bucket}`, {
            method: "POST",
            body: formData,
          });
          const json = await res.json();
          return { data: json.data || { path: filePath }, error: json.error || null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },

      getPublicUrl(filePath: string) {
        const cleanPath = String(filePath).replace(/^\/+/, "");
        const publicUrl = `/uploads/${bucket}/${cleanPath}`;
        return { data: { publicUrl } };
      },

      async remove(paths?: string[]) {
        return { data: null, error: null };
      },
    };
  },
};

const client = {
  from(collection: string) {
    return new MongoQueryBuilder(collection);
  },
  auth,
  storage,
};

export default client;
