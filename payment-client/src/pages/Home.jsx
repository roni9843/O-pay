import React from "react";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function Home() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .me(token)
      .then((data) => {
        setUser(data);
      })
      .catch((err) => {
        console.warn(err);
      })
      .finally(() => setLoading(false));
  }, [token, setUser]);

  return (
    <div>
      <h2 className="text-2xl mb-4">Welcome</h2>
      {!token ? (
        <p>Please register or login to continue.</p>
      ) : (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg">Your profile</h3>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <pre className="mt-2">{JSON.stringify(user, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
