import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authMessage, button, dialog, displayMessage, form, input, requiredElement, setButtonBusy } from "./dom";

type AuthMode = "sign_in" | "sign_up";

type AuthModeContent = {
  readonly title: string;
  readonly description: string;
  readonly submit: string;
  readonly toggle: string;
  readonly autocomplete: string;
};

const AUTH_MODE_CONTENT = {
  sign_in: {
    title: "登录账户",
    description: "登录后即可使用自己的 DeepSeek API Key 生成攻略。",
    submit: "登录",
    toggle: "还没有账户？注册",
    autocomplete: "current-password",
  },
  sign_up: {
    title: "创建账户",
    description: "注册后请检查邮箱，确认地址后即可登录。",
    submit: "注册",
    toggle: "已有账户？登录",
    autocomplete: "new-password",
  },
} as const satisfies Record<AuthMode, AuthModeContent>;

export function bindAuthDialog(
  client: SupabaseClient | null,
  onAuthenticated: (user: User) => Promise<void>,
): void {
  const authDialog = dialog("auth-dialog");
  const authSubmit = button("auth-submit");
  let authMode: AuthMode = "sign_in";

  function updateAuthMode(mode: AuthMode): void {
    authMode = mode;
    const content = AUTH_MODE_CONTENT[mode];
    requiredElement("auth-title").textContent = content.title;
    requiredElement("auth-description").textContent = content.description;
    authSubmit.textContent = content.submit;
    requiredElement("toggle-auth-mode").textContent = content.toggle;
    input("auth-password").autocomplete = content.autocomplete;
    displayMessage("auth-message", "");
  }

  button("open-auth").addEventListener("click", () => {
    updateAuthMode("sign_in");
    authDialog.showModal();
  });
  button("toggle-auth-mode").addEventListener("click", () => {
    updateAuthMode(authMode === "sign_in" ? "sign_up" : "sign_in");
  });

  form("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      displayMessage("auth-message", "请先按部署说明配置 Supabase。");
      return;
    }
    const email = input("auth-email").value.trim();
    const password = input("auth-password").value;
    const content = AUTH_MODE_CONTENT[authMode];
    setButtonBusy(authSubmit, true, authMode === "sign_in" ? "正在登录…" : "正在注册…", content.submit);
    displayMessage("auth-message", "");
    try {
      if (authMode === "sign_in") {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        authDialog.close();
        await onAuthenticated(data.user);
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session || !data.user) {
          displayMessage("auth-message", "注册请求已提交。请检查邮箱并确认地址，然后返回登录。", true);
        } else {
          authDialog.close();
          await onAuthenticated(data.user);
        }
      }
    } catch (error) {
      displayMessage("auth-message", authMessage(error));
    } finally {
      setButtonBusy(authSubmit, false, "正在提交…", AUTH_MODE_CONTENT[authMode].submit);
    }
  });
}
