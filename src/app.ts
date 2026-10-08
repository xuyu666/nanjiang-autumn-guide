import type { User } from "@supabase/supabase-js";
import { AppFunctionError, generateGuide, getApiKeyStatus } from "./lib/functions";
import { GuideRequestSchema, renderGuideMarkdown, type GuideRequest } from "./lib/guide";
import { supabase } from "./lib/supabase";
import { bindAuthDialog } from "./ui/auth-dialog";
import { button, dialog, displayMessage, form, input, requiredElement, setButtonBusy, userMessage } from "./ui/dom";
import { bindSettingsDialog } from "./ui/settings-dialog";

export function startApp(): void {
  const configNote = requiredElement("config-note");
  const authDialog = dialog("auth-dialog");
  const settingsDialog = dialog("settings-dialog");
  const guideArticle = requiredElement("guide-article");
  const emptyState = requiredElement("empty-state");
  const loadingState = requiredElement("loading-state");
  const generateButton = button("generate");
  let currentUser: User | null = null;
  let pendingRoute: GuideRequest | null = null;
  let guideText = "";
  let toastTimer = 0;

  if (!supabase) {
    configNote.hidden = false;
    configNote.textContent = "网站尚未连接 Supabase。按部署说明配置项目地址和 Publishable Key 后即可使用账号功能。";
  }

  function showToast(message: string): void {
    const toast = requiredElement("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  async function refreshKeyStatus(): Promise<void> {
    const status = requiredElement("key-status");
    const deleteKeyButton = button("delete-key");
    if (!supabase || !currentUser) {
      status.textContent = "登录后配置个人 API Key。";
      deleteKeyButton.hidden = true;
      return;
    }
    status.textContent = "正在检查密钥状态…";
    try {
      const result = await getApiKeyStatus(supabase);
      status.textContent = result.configured
        ? "已配置密钥。出于安全考虑，页面不会读取或显示密钥内容。"
        : "尚未配置密钥。保存后即可生成攻略。";
      deleteKeyButton.hidden = !result.configured;
    } catch (error) {
      if (error instanceof Error) {
        status.textContent = "暂时无法读取密钥状态，请检查连接后重试。";
        deleteKeyButton.hidden = true;
        return;
      }
      throw error;
    }
  }

  async function updateAccount(user: User | null): Promise<void> {
    currentUser = user;
    button("open-auth").hidden = Boolean(user);
    requiredElement("signed-in").hidden = !user;
    requiredElement("account-email").textContent = user?.email ?? "";
    if (user) await refreshKeyStatus();
  }

  async function runGuide(route: GuideRequest): Promise<void> {
    if (!supabase || !currentUser) {
      pendingRoute = route;
      displayMessage("feedback", "登录后才能生成攻略。登录成功后可以继续刚才的路线。", true);
      if (!authDialog.open) authDialog.showModal();
      return;
    }
    displayMessage("feedback", "");
    guideArticle.hidden = true;
    emptyState.hidden = true;
    loadingState.hidden = false;
    setButtonBusy(generateButton, true, "正在整理…", "生成旅行攻略 →");
    try {
      const result = await generateGuide(supabase, route);
      guideText = result.markdown;
      requiredElement("guide-title").textContent = `${route.origin} 到 ${route.destination}`;
      requiredElement("route-summary").textContent = `${route.origin}　→　${route.destination}`;
      requiredElement("guide-body").innerHTML = renderGuideMarkdown(result.markdown);
      guideArticle.hidden = false;
      guideArticle.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      emptyState.hidden = false;
      displayMessage("feedback", userMessage(error));
      if (error instanceof AppFunctionError && error.code === "missing_api_key") {
        settingsDialog.showModal();
        await refreshKeyStatus();
      }
    } finally {
      loadingState.hidden = true;
      setButtonBusy(generateButton, false, "正在整理…", "生成旅行攻略 →");
    }
  }

  async function handleAuthenticated(user: User): Promise<void> {
    await updateAccount(user);
    if (pendingRoute) {
      const route = pendingRoute;
      pendingRoute = null;
      await runGuide(route);
    }
  }

  form("travel-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const parsed = GuideRequestSchema.safeParse({
      origin: input("origin").value,
      destination: input("destination").value,
    });
    if (!parsed.success) {
      displayMessage("feedback", "请填写出发地和目的地，每项不超过 80 个字符。");
      return;
    }
    void runGuide(parsed.data);
  });

  bindAuthDialog(supabase, handleAuthenticated);
  bindSettingsDialog({
    client: supabase,
    getUser: () => currentUser,
    refreshKeyStatus,
    showToast,
  });

  button("sign-out").addEventListener("click", async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        displayMessage("feedback", "退出失败，请重试。");
      } else {
        pendingRoute = null;
        guideText = "";
        guideArticle.hidden = true;
        emptyState.hidden = false;
        displayMessage("feedback", "已安全退出。", true);
      }
    } catch (error) {
      displayMessage("feedback", userMessage(error));
    }
  });

  button("copy-guide").addEventListener("click", async () => {
    try {
      const note = guideArticle.querySelector(".disclaimer")?.textContent ?? "";
      const title = requiredElement("guide-title").textContent ?? "";
      const route = requiredElement("route-summary").textContent ?? "";
      await navigator.clipboard.writeText(`${title}\n\n${guideText}\n\n${route}\n${note}`);
      showToast("攻略已复制");
    } catch (error) {
      if (error instanceof Error) {
        displayMessage("feedback", "复制失败，请检查浏览器剪贴板权限。");
        return;
      }
      throw error;
    }
  });

  button("print-guide").addEventListener("click", () => window.print());
  document.querySelectorAll<HTMLButtonElement>("[data-close]").forEach((closeButton) => {
    closeButton.addEventListener("click", () => {
      const targetId = closeButton.dataset.close;
      if (targetId) dialog(targetId).close();
    });
  });

  if (supabase) {
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) displayMessage("feedback", "无法读取登录状态，请刷新页面重试。");
        void updateAccount(data.session?.user ?? null);
      })
      .catch((error: unknown) => displayMessage("feedback", userMessage(error)));
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      window.setTimeout(() => void updateAccount(user), 0);
    });
  }
}
