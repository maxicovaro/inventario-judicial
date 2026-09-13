const { Op } = require("sequelize");
const { Activo } = require("../models");
const { esAdminGeneral } = require("../utils/permisos");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MAX_SEARCH_LENGTH = 100;

const parsePositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, "\\$&");

const listarCatalogoActivos = async (req, res) => {
  try {
    const direccion = esAdminGeneral(req.usuario);

    if (!direccion && !req.usuario?.oficina_id) {
      return res.status(403).json({ mensaje: "El usuario no tiene oficina asignada" });
    }

    const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    if (!limit) {
      return res.status(400).json({
        mensaje: `limit debe estar entre 1 y ${MAX_LIMIT}`,
      });
    }

    const search = String(req.query.q || "").trim();
    if (search.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        mensaje: `La búsqueda no puede superar ${MAX_SEARCH_LENGTH} caracteres`,
      });
    }

    let oficinaId = req.usuario.oficina_id;
    if (direccion) {
      oficinaId = null;
      if (req.query.oficina_id !== undefined && req.query.oficina_id !== "") {
        oficinaId = parsePositiveInteger(req.query.oficina_id, null);
        if (!oficinaId) {
          return res.status(400).json({ mensaje: "oficina_id inválido" });
        }
      }
    }

    const where = {
      activo: true,
      estado: { [Op.ne]: "Dado de baja" },
    };

    if (oficinaId) where.oficina_id = oficinaId;

    if (search) {
      const like = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { nombre: { [Op.like]: like } },
        { codigo_interno: { [Op.like]: like } },
        { numero_serie: { [Op.like]: like } },
      ];
    }

    const activos = await Activo.findAll({
      where,
      attributes: ["id", "nombre", "codigo_interno", "oficina_id"],
      order: [["nombre", "ASC"], ["id", "ASC"]],
      limit,
    });

    return res.status(200).json({
      items: activos,
      limit,
      filters: {
        q: search,
        oficina_id: oficinaId || null,
      },
    });
  } catch (error) {
    console.error("Error al listar catálogo de activos:", error);
    return res.status(500).json({ mensaje: "Error al listar catálogo de activos" });
  }
};

module.exports = { listarCatalogoActivos };
