const express = require("express");
const {
  listAccounts,
  upsertAccount,
  updateAccountToken,
  setAccountActive,
} = require("./accounts.service");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const data = await listAccounts();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const account = await upsertAccount(req.body ?? {});
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/token", async (req, res, next) => {
  try {
    const account = await updateAccountToken(req.params.id, req.body ?? {});
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/active", async (req, res, next) => {
  try {
    const ativo =
      typeof req.body?.ativo === "boolean"
        ? req.body.ativo
        : String(req.body?.ativo ?? "false").toLowerCase() === "true";

    const account = await setAccountActive(req.params.id, ativo);
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.post("/bootstrap-env", async (req, res, next) => {
  try {
    const body = req.body ?? {};

    const instagramId =
      body.instagramId ??
      process.env.IG_ACCOUNT_ID ??
      process.env.BOOTSTRAP_IG_ACCOUNT_ID;
    const accessToken =
      body.accessToken ??
      process.env.META_TOKEN ??
      process.env.BOOTSTRAP_META_TOKEN ??
      process.env.META_FALLBACK_TOKEN;

    const account = await upsertAccount({
      instagramId,
      accessToken,
      pageId: body.pageId ?? process.env.BOOTSTRAP_PAGE_ID,
      nome:
        body.nome ??
        body.accountName ??
        process.env.BOOTSTRAP_ACCOUNT_NAME ??
        "Conta importada do env",
      tokenExpiresAt:
        body.tokenExpiresAt ?? process.env.BOOTSTRAP_TOKEN_EXPIRES_AT,
      ativo: true,
    });

    res.json({
      message: "Conta importada/atualizada a partir de variaveis de ambiente.",
      account,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
