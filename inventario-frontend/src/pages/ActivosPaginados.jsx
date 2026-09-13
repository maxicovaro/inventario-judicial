import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import { Alert, Button, Card, ConfirmDialog, PageHeader, StatCard } from "../components/ui";
import { activoSchema } from "../schemas/activoSchema";
import { esAdminGeneral, puedeGestionarOficina } from "../utils/permisos";
import ActivosTable from "../components/activos/ActivosTable";
import ActivoForm from "../components/activos/ActivoForm";
import "../styles/assets.css";
import "../styles/assets-table-responsive.css";

const defaults = { codigo_interno:"", nombre:"", descripcion:"", marca:"", modelo:"", numero_serie:"", cantidad:1, estado:"Buen estado", fecha_alta:"", observaciones:"", categoria_id:"", oficina_id:"" };
const estados = ["Excelente estado","Buen estado","Regular estado","Mal estado","Sin funcionar"];
const emptySummary = { total:0, vigentes:0, atencion:0, diversidad:0 };
const emptyPagination = { page:1, page_size:25, total:0, total_pages:0 };
const usuarioLocal = () => { try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; } };
const fechaInput = (value) => value ? String(value).slice(0,10) : "";

export default function ActivosPaginados() {
  const usuario = usuarioLocal();
  const direccion = esAdminGeneral(usuario);
  const gestiona = puedeGestionarOficina(usuario);
  const [activos,setActivos]=useState([]), [categorias,setCategorias]=useState([]), [oficinas,setOficinas]=useState([]);
  const [summary,setSummary]=useState(emptySummary), [pagination,setPagination]=useState(emptyPagination);
  const [page,setPage]=useState(1), [pageSize,setPageSize]=useState(25), [search,setSearch]=useState(""), [query,setQuery]=useState("");
  const [estado,setEstado]=useState(""), [oficina,setOficina]=useState("");
  const [error,setError]=useState(""), [mensaje,setMensaje]=useState(""), [loading,setLoading]=useState(false), [saving,setSaving]=useState(false);
  const [editId,setEditId]=useState(null), [detailId,setDetailId]=useState(null), [formOpen,setFormOpen]=useState(gestiona), [baja,setBaja]=useState(null), [bajando,setBajando]=useState(false);
  const form = useForm({ resolver:zodResolver(activoSchema), defaultValues:{...defaults, oficina_id:direccion?"":String(usuario.oficina_id||"")} });

  const loadCatalogs = useCallback(async()=>{
    try { const [c,o]=await Promise.all([api.get("/categorias"),api.get("/oficinas")]); setCategorias(c.data||[]); setOficinas(o.data||[]); }
    catch(e){ setError(e.response?.data?.mensaje||"Error al cargar catálogos"); }
  },[]);

  const load = useCallback(async(targetPage=page)=>{
    try {
      setLoading(true); setError("");
      const params={page:targetPage,page_size:pageSize}; if(query) params.q=query; if(estado) params.estado=estado; if(direccion&&oficina) params.oficina_id=oficina;
      const {data}=await api.get("/activos",{params});
      setActivos(data?.items||[]); setSummary(data?.summary||emptySummary); setPagination(data?.pagination||emptyPagination);
      if(Number(data?.pagination?.page||targetPage)!==Number(page)) setPage(Number(data.pagination.page));
    } catch(e){ setError(e.response?.data?.mensaje||"Error al cargar activos"); }
    finally { setLoading(false); }
  },[page,pageSize,query,estado,oficina,direccion]);

  useEffect(()=>{ loadCatalogs(); },[loadCatalogs]);
  useEffect(()=>{ const t=setTimeout(()=>{setQuery(search.trim());setPage(1);},300); return()=>clearTimeout(t); },[search]);
  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ if(!direccion) form.setValue("oficina_id",String(usuario.oficina_id||"")); },[direccion,usuario.oficina_id,form]);

  const resetForm=()=>{ form.reset({...defaults,oficina_id:direccion?"":String(usuario.oficina_id||"")}); setEditId(null); };
  const openNew=()=>{setError("");setMensaje("");resetForm();setFormOpen(true);};
  const edit=async(item)=>{ try { setDetailId(item.id); const {data}=await api.get(`/activos/${item.id}`); form.reset({...defaults,...data,cantidad:Number(data.cantidad||1),fecha_alta:fechaInput(data.fecha_alta),categoria_id:String(data.categoria_id||""),oficina_id:direccion?String(data.oficina_id||""):String(usuario.oficina_id||"")}); setEditId(data.id); setFormOpen(true); } catch(e){setError(e.response?.data?.mensaje||"Error al cargar el detalle del activo");} finally{setDetailId(null);} };
  const submit=async(data)=>{ if(!gestiona) return; try { setSaving(true);setError("");setMensaje(""); const payload={...data,cantidad:Number(data.cantidad||1),fecha_alta:data.fecha_alta||null,oficina_id:direccion?data.oficina_id:usuario.oficina_id}; if(editId){await api.put(`/activos/${editId}`,payload);setMensaje("Activo actualizado correctamente");}else{await api.post("/activos",payload);setMensaje("Activo creado correctamente");} resetForm(); setPage(1); await load(1); } catch(e){setError(e.response?.data?.mensaje||e.response?.data?.error||"Error al guardar el activo");} finally{setSaving(false);} };
  const confirmBaja=async()=>{ if(!baja)return; try{setBajando(true);await api.patch(`/activos/${baja.id}/baja`);setMensaje("Activo dado de baja correctamente");const p=activos.length===1&&page>1?page-1:page;setPage(p);setBaja(null);await load(p);}catch(e){setError(e.response?.data?.mensaje||"Error al dar de baja el activo");}finally{setBajando(false);} };
  const clearFilters=()=>{setSearch("");setQuery("");setEstado("");setOficina("");setPage(1);};

  return <Layout><div className="ui-page assets-page">
    <PageHeader eyebrow="Inventario patrimonial" title="Activos" description="Consultá, buscá y gestioná los bienes con paginación server-side y alcance seguro por oficina." actions={gestiona?<Button onClick={openNew}>Nuevo activo</Button>:null}/>
    <section className="assets-summary" aria-label="Resumen de activos">
      <StatCard label="Activos registrados" value={summary.total} detail="Alcance autorizado" />
      <StatCard label="Vigentes" value={summary.vigentes} detail="Disponibles para gestión" tone="success" />
      <StatCard label="Requieren atención" value={summary.atencion} detail="Mal estado o sin funcionar" tone="warning" />
      <StatCard label={direccion?"Oficinas con activos":"Categorías activas"} value={summary.diversidad} detail="Diversidad del inventario" tone="accent" />
    </section>
    <div className="ops-message-stack" aria-live="polite">{mensaje&&<Alert tone="success">{mensaje}</Alert>}{error&&<Alert tone="danger">{error}</Alert>}</div>
    <Card className="assets-list-card">
      <div className="assets-toolbar">
        <input className="ui-control" placeholder="Buscar por nombre, código, marca, modelo..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="ui-control" aria-label="Filtrar por estado" value={estado} onChange={e=>{setEstado(e.target.value);setPage(1);}}><option value="">Todos los estados</option>{estados.map(x=><option key={x}>{x}</option>)}</select>
        {direccion&&<select className="ui-control" aria-label="Filtrar por oficina" value={oficina} onChange={e=>{setOficina(e.target.value);setPage(1);}}><option value="">Todas las oficinas</option>{oficinas.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
        {(search||estado||oficina)&&<Button variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>}
      </div>
      <div className="assets-toolbar"><span>{pagination.total} resultados</span><label>Filas por página <select className="ui-control" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[25,50,100].map(n=><option key={n}>{n}</option>)}</select></label></div>
      <ActivosTable activos={activos} loading={loading} usuario={usuario} direccion={direccion} gestiona={gestiona} detailId={detailId} onEdit={edit} onBaja={setBaja}/>
      <nav className="assets-toolbar" aria-label="Paginación de activos"><Button variant="secondary" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Anterior</Button><span>Página {pagination.total_pages?pagination.page:0} de {pagination.total_pages}</span><Button variant="secondary" disabled={page>=pagination.total_pages||loading||pagination.total_pages===0} onClick={()=>setPage(p=>p+1)}>Siguiente</Button></nav>
    </Card>
    {gestiona&&formOpen&&<ActivoForm form={form} categorias={categorias} oficinas={oficinas} direccion={direccion} usuario={usuario} editing={Boolean(editId)} saving={saving} onSubmit={submit} onCancel={()=>{resetForm();setFormOpen(false);}} />}
    <ConfirmDialog open={Boolean(baja)} title="Dar de baja el activo" description={baja?`Vas a dar de baja “${baja.nombre}”. Esta acción quedará registrada en la trazabilidad del sistema.`:""} confirmLabel="Dar de baja" busy={bajando} onCancel={()=>!bajando&&setBaja(null)} onConfirm={confirmBaja}/>
  </div></Layout>;
}
