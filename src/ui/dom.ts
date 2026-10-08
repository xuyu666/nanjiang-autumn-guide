import { AppFunctionError } from "../lib/functions";

export function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required page element is missing: ${id}`);
  return element;
}

export function input(id: string): HTMLInputElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Expected an input: ${id}`);
  return element;
}

export function button(id: string): HTMLButtonElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Expected a button: ${id}`);
  return element;
}

export function form(id: string): HTMLFormElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLFormElement)) throw new Error(`Expected a form: ${id}`);
  return element;
}

export function dialog(id: string): HTMLDialogElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLDialogElement)) throw new Error(`Expected a dialog: ${id}`);
  return element;
}

export function displayMessage(id: string, message: string, success = false): void {
  const element = requiredElement(id);
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("success", success);
}

export function setButtonBusy(element: HTMLButtonElement, busy: boolean, busyLabel: string, normalLabel: string): void {
  element.disabled = busy;
  element.textContent = busy ? busyLabel : normalLabel;
}

export function userMessage(error: unknown): string {
  if (error instanceof AppFunctionError) return error.message;
  if (error instanceof Error && error.name === "ZodError") return "请检查输入内容后重试。";
  return "操作未完成，请检查网络后重试。";
}

export function authMessage(error: unknown): string {
  if (!(error instanceof Error)) return "登录或注册失败，请检查信息后重试。";
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return "邮箱或密码不正确。";
  if (message.includes("email not confirmed")) return "请先确认邮箱，再登录。";
  if (message.includes("already registered")) return "这个邮箱已注册，请直接登录。";
  if (message.includes("rate limit")) return "请求过于频繁，请稍后重试。";
  if (message.includes("password")) return "密码不符合要求，请使用至少 8 位密码。";
  return "登录或注册失败，请检查网络和邮箱地址后重试。";
}
