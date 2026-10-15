import { apiUrl, requireBackend, friendlyError } from "./firebase";
import { getAuth } from "firebase/auth";

export async function managementCall(name, input = {}) {
  requireBackend();
  try {
    const user = getAuth().currentUser;
    if (!user) throw { code: "functions/unauthenticated" };
    const token = await user.getIdToken();
    const res = await fetch(`${apiUrl}/api/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || "Request failed");
      err.code = `functions/${data.error || res.status}`;
      throw err;
    }
    if (!data || typeof data !== "object")
      throw new Error(
        "Invalid management service response. Nothing was confirmed.",
      );
    return data;
  } catch (error) {
    if (["functions/not-found", "functions/unimplemented", "functions/404"].includes(error.code))
      throw new Error(
        `Backend setup pending: ${name} is not deployed. Give Codex CODEX_BACKEND_PROMPT.md. No local substitute is enabled.`,
      );
    if (
      [
        "functions/internal",
        "functions/unavailable",
        "functions/deadline-exceeded",
        "functions/500",
      ].includes(error.code)
    )
      throw new Error(
        "School service unavailable or misconfigured. Check callable deployment and server logs using CODEX_BACKEND_PROMPT.md. No change was confirmed; refresh before retrying a write.",
      );
    if (error.code === "functions/permission-denied")
      throw new Error(
        "Only an authorized teacher or administrator can perform this action.",
      );
    throw new Error(friendlyError(error));
  }
}
