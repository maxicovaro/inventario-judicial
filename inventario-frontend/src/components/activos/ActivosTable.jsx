import { Fragment, useState } from "react";
import { Badge, Button, EmptyState, TableFrame } from "../ui";
import AdjuntosPanel from "../AdjuntosPanel";

const estadoTone = (estado) => {
  if (estado === "Excelente estado") return "success";
  if (estado === "Buen estado") return "info";
  if (estado === "Regular estado") return "warning";
  if (estado === "Dado de baja") return "neutral";
  return "danger";
};

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

export default function ActivosTable({
  activos,
  loading,
  usuario,
  direccion,
  gestiona,
  detailId,
  onEdit,
  onBaja,
}) {
  const [adjuntoAbierto, setAdjuntoAbierto] = useState(null);

  if (loading) {
    return <p aria-live="polite">Cargando activos...</p>;
  }

  if (!activos.length) {
    return (
      <EmptyState
        title="No hay activos para mostrar"
        description="Probá cambiar los filtros o la búsqueda."
      />
    );
  }

  return (
    <TableFrame label="Listado de activos">
      <table className="ui-table assets-table">
        <caption className="sr-only">Listado de activos patrimoniales</caption>
        <thead>
          <tr>
            <th scope="col">Activo</th>
            <th scope="col">Categoría</th>
            <th scope="col">Oficina</th>
            <th scope="col">Marca / modelo</th>
            <th scope="col">Estado</th>
            <th scope="col">Cantidad</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {activos.map((activo) => {
            const perteneceAMiOficina =
              String(activo.oficina_id) === String(usuario.oficina_id);
            const puedeVer = direccion || perteneceAMiOficina;
            const estaDeBaja =
              activo.activo === false || activo.estado === "Dado de baja";
            const puedeEditar = gestiona && puedeVer && !estaDeBaja;
            const adjuntosAbiertos = adjuntoAbierto === activo.id;

            return (
              <Fragment key={activo.id}>
                <tr className={estaDeBaja ? "assets-row--inactive" : ""}>
                  <td>
                    <div className="assets-primary-cell">
                      <span className="assets-primary-name">{activo.nombre}</span>
                      <span className="assets-primary-code">
                        {activo.codigo_interno || `ID #${activo.id}`}
                        {activo.numero_serie ? ` · Serie ${activo.numero_serie}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="assets-muted">
                    {activo.Categoria?.nombre || activo.Categorium?.nombre || "-"}
                  </td>
                  <td className="assets-muted">{activo.Oficina?.nombre || "-"}</td>
                  <td className="assets-muted">
                    {[activo.marca, activo.modelo].filter(Boolean).join(" · ") || "-"}
                  </td>
                  <td>
                    <Badge tone={estadoTone(activo.estado)}>
                      {activo.estado || "Sin estado"}
                    </Badge>
                  </td>
                  <td className="assets-muted">{formatearNumero(activo.cantidad)}</td>
                  <td>
                    <div className="assets-row-actions">
                      {puedeEditar && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={detailId === activo.id}
                          busy={detailId === activo.id}
                          onClick={() => onEdit(activo)}
                          aria-label={`Editar ${activo.nombre}`}
                        >
                          Editar
                        </Button>
                      )}
                      {puedeVer && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setAdjuntoAbierto(adjuntosAbiertos ? null : activo.id)
                          }
                          aria-expanded={adjuntosAbiertos}
                          aria-controls={`adjuntos-activo-${activo.id}`}
                        >
                          {adjuntosAbiertos ? "Ocultar adjuntos" : "Adjuntos"}
                        </Button>
                      )}
                      {direccion && !estaDeBaja && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onBaja(activo)}
                          aria-label={`Dar de baja ${activo.nombre}`}
                        >
                          Dar de baja
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {adjuntosAbiertos && puedeVer && (
                  <tr>
                    <td colSpan="7" className="assets-inline-detail">
                      <div
                        className="assets-detail-shell"
                        id={`adjuntos-activo-${activo.id}`}
                      >
                        <div className="assets-detail-header">
                          <p className="assets-detail-title">
                            Adjuntos · {activo.nombre}
                          </p>
                        </div>
                        <AdjuntosPanel activoId={activo.id} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}
