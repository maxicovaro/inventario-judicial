import { Button, Card, Field } from "../ui";
const estados=["Excelente estado","Buen estado","Regular estado","Mal estado","Sin funcionar"];
export default function ActivoForm({form,categorias,oficinas,direccion,usuario,editing,saving,onSubmit,onCancel}){
 const {register,handleSubmit,formState:{errors}}=form;
 return <Card className="assets-form-card"><form onSubmit={handleSubmit(onSubmit)}><h2>{editing?"Editar activo":"Nuevo activo"}</h2><div className="assets-form-grid">
  <Field label="Código interno" error={errors.codigo_interno}><input className="ui-control" placeholder="Código interno" {...register("codigo_interno")}/></Field>
  <Field label="Nombre" error={errors.nombre}><input className="ui-control" placeholder="Nombre" {...register("nombre")}/></Field>
  <Field label="Marca" error={errors.marca}><input className="ui-control" placeholder="Marca" {...register("marca")}/></Field>
  <Field label="Modelo" error={errors.modelo}><input className="ui-control" placeholder="Modelo" {...register("modelo")}/></Field>
  <Field label="Número de serie" error={errors.numero_serie}><input className="ui-control" placeholder="Número de serie" {...register("numero_serie")}/></Field>
  <Field label="Categoría" error={errors.categoria_id}><select className="ui-control" {...register("categoria_id")}><option value="">Seleccionar categoría</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
  <Field label="Estado" error={errors.estado}><select className="ui-control" {...register("estado")}>{estados.map(e=><option key={e}>{e}</option>)}</select></Field>
  <Field label="Cantidad" error={errors.cantidad}><input className="ui-control" type="number" min="1" {...register("cantidad")}/></Field>
  <Field label="Fecha de alta" error={errors.fecha_alta}><input className="ui-control" type="date" {...register("fecha_alta")}/></Field>
  <Field label="Oficina" error={errors.oficina_id}>{direccion?<select className="ui-control" {...register("oficina_id")}><option value="">Seleccionar oficina</option>{oficinas.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select>:<><input className="ui-control" value={usuario.oficina_nombre||usuario.Oficina?.nombre||"Mi oficina"} disabled readOnly/><input type="hidden" {...register("oficina_id")}/></>}</Field>
  <Field className="assets-field--full" label="Descripción" error={errors.descripcion}><textarea className="ui-control assets-textarea" placeholder="Descripción" {...register("descripcion")}/></Field>
  <Field className="assets-field--full" label="Observaciones" error={errors.observaciones}><textarea className="ui-control assets-textarea" placeholder="Observaciones" {...register("observaciones")}/></Field>
 </div><div className="assets-form-actions"><Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving} busy={saving}>{saving?"Guardando...":editing?"Actualizar activo":"Crear activo"}</Button></div></form></Card>;
}
