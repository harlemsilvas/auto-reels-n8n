const express = require("express");
const {
  requireAdminSession,
  requireCsrf,
  requirePermission,
} = require("../auth/admin-auth.middleware");
const { PERMISSIONS } = require("../auth/permissions.service");
const {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
} = require("./users.service");

const router = express.Router();

router.use(
  requireAdminSession,
  requirePermission(PERMISSIONS.USERS_MANAGE),
);

router.get("/", async (_req, res, next) => {
  try {
    return res.json(await listUsers());
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireCsrf, async (req, res, next) => {
  try {
    const user = await createUser(req.body ?? {}, req.auth, req);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", requireCsrf, async (req, res, next) => {
  try {
    const user = await updateUser(req.params.id, req.body ?? {}, req.auth, req);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/reset-password", requireCsrf, async (req, res, next) => {
  try {
    await resetUserPassword(
      req.params.id,
      req.body?.password,
      req.auth,
      req,
    );
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
