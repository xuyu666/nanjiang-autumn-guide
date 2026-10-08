import type { SupabaseClient, User } from "@supabase/supabase-js";
import { deleteApiKey, saveApiKey } from "../lib/functions";
import { button, dialog, displayMessage, form, input, setButtonBusy, userMessage } from "./dom";

type SettingsDialogOptions = {
  readonly client: SupabaseClient | null;
  readonly getUser: () => User | null;
  readonly refreshKeyStatus: () => Promise<void>;
  readonly showToast: (message: string) => void;
};

export function bindSettingsDialog(options: SettingsDialogOptions): void {
  const saveButton = button("save-key");

  button("open-settings").addEventListener("click", () => {
    displayMessage("settings-message", "");
    dialog("settings-dialog").showModal();
    void options.refreshKeyStatus();
  });

  form("settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!options.client || !options.getUser()) {
      displayMessage("settings-message", "请先登录后再保存 API Key。");
      return;
    }
    const apiKey = input("api-key").value.trim();
    if (apiKey.length < 12) {
      displayMessage("settings-message", "请输入有效的 DeepSeek API Key。");
      return;
    }
    setButtonBusy(saveButton, true, "正在加密保存…", "保存密钥");
    try {
      await saveApiKey(options.client, apiKey);
      input("api-key").value = "";
      displayMessage("settings-message", "密钥已安全保存。", true);
      options.showToast("API Key 已保存");
      await options.refreshKeyStatus();
    } catch (error) {
      displayMessage("settings-message", userMessage(error));
    } finally {
      setButtonBusy(saveButton, false, "正在加密保存…", "保存密钥");
    }
  });

  button("delete-key").addEventListener("click", async () => {
    if (!options.client || !options.getUser()) return;
    const deleteButton = button("delete-key");
    deleteButton.disabled = true;
    try {
      await deleteApiKey(options.client);
      displayMessage("settings-message", "已删除保存的密钥。", true);
      options.showToast("API Key 已删除");
      await options.refreshKeyStatus();
    } catch (error) {
      displayMessage("settings-message", userMessage(error));
    } finally {
      deleteButton.disabled = false;
    }
  });
}
