"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import {
  listDepartments,
  listProvincesByDepartment,
  listDistrictsByProvince,
} from "@/lib/ubigeo/ubigeo";
import "./perfil.css";

import {
  UserRound,
  IdCard,
  Phone,
  MapPin,
  Landmark,
  Save,
  Loader2,
  AlertCircle,
  Mail,
  GraduationCap,
} from "lucide-react";

type BuyerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  city: string | null; // "Dept - Prov"
  reference: string | null;
  student_full_name: string | null;
  school_name: string | null;

  // NEW
  colegio_id: number | null;
};

type Option = { id: string; name: string };

type ColegioOption = {
  id: number;
  nombre_comercial: string | null;
  ruc: string | null;
};

function findIdByName(options: Option[], name: string) {
  const n = name.trim().toLowerCase();
  return options.find((o) => o.name.trim().toLowerCase() === n)?.id || "";
}

export default function PerfilClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const search = useSearchParams();

  const nextPath = search.get("next") || "/checkout";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");

  // colegios list
  const [colegios, setColegios] = useState<ColegioOption[]>([]);
  const [colegioId, setColegioId] = useState<string>(""); // store as string for <select>

  // form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [documentType, setDocumentType] = useState("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");

  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [reference, setReference] = useState("");

  // ubigeo
  const departments = useMemo<Option[]>(() => listDepartments(), []);
  const [departmentId, setDepartmentId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");

  const provinces = useMemo<Option[]>(
    () => (departmentId ? listProvincesByDepartment(departmentId) : []),
    [departmentId]
  );
  const districts = useMemo<Option[]>(
    () => (provinceId ? listDistrictsByProvince(provinceId) : []),
    [provinceId]
  );

  const departmentName = useMemo(
    () => departments.find((d) => d.id === departmentId)?.name || "",
    [departments, departmentId]
  );

  const provinceName = useMemo(
    () => provinces.find((p) => p.id === provinceId)?.name || "",
    [provinces, provinceId]
  );
  const districtName = useMemo(
    () => districts.find((d) => d.id === districtId)?.name || "",
    [districts, districtId]
  );

  const [studentFullName, setStudentFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: u } = await supabase.auth.getUser();
      const user = u.user;

      if (!user) {
        const back = `/perfil?next=${encodeURIComponent(nextPath)}`;
        window.location.href = `/auth/login?next=${encodeURIComponent(back)}`;
        return;
      }

      if (!alive) return;
      setEmail(user.email || "");

      // load colegios (for discounts)
      const { data: colData, error: colErr } = await supabase
        .from("colegios")
        .select("id,nombre_comercial,ruc")
        .order("nombre_comercial", { ascending: true });

      if (!alive) return;
      if (colErr) {
        // no hard-fail, but show warning
        console.warn("Failed to load colegios:", colErr.message);
        setColegios([]);
      } else {
        setColegios((colData as ColegioOption[]) ?? []);
      }

      const { data } = await supabase
        .from("buyers")
        .select(
          "id,first_name,last_name,document_type,document_number,phone,address_line1,address_line2,district,city,reference,student_full_name,school_name,colegio_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      const buyer = (data as BuyerRow | null) ?? null;

      setFirstName(buyer?.first_name ?? "");
      setLastName(buyer?.last_name ?? "");
      setDocumentType(buyer?.document_type ?? "DNI");
      setDocumentNumber(buyer?.document_number ?? "");
      setPhone(buyer?.phone ?? "");

      setAddress1(buyer?.address_line1 ?? "");
      setAddress2(buyer?.address_line2 ?? "");
      setReference(buyer?.reference ?? "");

      setStudentFullName(buyer?.student_full_name ?? "");
      setSchoolName(buyer?.school_name ?? "");

      // colegio selection (optional)
      setColegioId(buyer?.colegio_id != null ? String(buyer.colegio_id) : "");

      // best-effort ubigeo map
      const city = buyer?.city || "";
      const dist = buyer?.district || "";

      if (city.includes(" - ")) {
        const [deptName, provName] = city.split(" - ").map((x) => x.trim());
        const deptId = findIdByName(departments, deptName);
        if (deptId) {
          setDepartmentId(deptId);
          const provs = listProvincesByDepartment(deptId);
          const provId = findIdByName(provs, provName);
          if (provId) {
            setProvinceId(provId);
            const dists = listDistrictsByProvince(provId);
            const distId = findIdByName(dists, dist);
            if (distId) setDistrictId(distId);
          }
        }
      }

      setLoading(false);
    };

    load();
    return () => {
      alive = false;
    };
  }, [supabase, departments, nextPath]);

  const validate = () => {
    if (!firstName.trim()) return "Nombres requeridos.";
    if (!lastName.trim()) return "Apellidos requeridos.";
    if (!documentNumber.trim()) return "Documento requerido.";
    if (!phone.trim()) return "Celular requerido.";
    if (!address1.trim()) return "Dirección requerida.";
    if (!departmentId) return "Selecciona departamento.";
    if (!provinceId) return "Selecciona provincia.";
    if (!districtId) return "Selecciona distrito.";
    return null;
  };

  const onSave = async () => {
    setOkMsg(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;

      if (!user) {
        const back = `/perfil?next=${encodeURIComponent(nextPath)}`;
        window.location.href = `/auth/login?next=${encodeURIComponent(back)}`;
        return;
      }

      const cityValue =
        [departmentName, provinceName].filter(Boolean).join(" - ") || "Lima";
      const districtValue = districtName || "";

      const colegioIdValue =
        colegioId && colegioId.trim() ? Number(colegioId) : null;

      const { error: upErr } = await supabase.from("buyers").upsert(
        {
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          document_type: documentType,
          document_number: documentNumber.trim(),
          phone: phone.trim(),
          address_line1: address1.trim(),
          address_line2: address2.trim() || null,
          city: cityValue,
          district: districtValue,
          reference: reference.trim() || null,
          student_full_name: studentFullName.trim() || null,
          school_name: schoolName.trim() || null,

          // NEW
          colegio_id: colegioIdValue,
        },
        { onConflict: "id" }
      );

      if (upErr) throw upErr;

      setOkMsg("Perfil guardado ✅");
      window.location.href = nextPath;
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="perfilPage">
        <div className="perfilCard">
          <div className="perfilLoading">
            <Loader2 className="spin" size={16} /> Cargando perfil…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="perfilPage">
      <div className="perfilCard">
        <div className="perfilTop">
          <h1 className="perfilTitle">Perfil</h1>
          <div className="perfilSub">
            <Mail size={14} /> <span>{email || "—"}</span>
          </div>
        </div>

        <div className="perfilGrid">
          <div className="perfilField">
            <label>Nombres</label>
            <div className="perfilInput">
              <UserRound size={16} />
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div className="perfilField">
            <label>Apellidos</label>
            <div className="perfilInput">
              <UserRound size={16} />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="perfilField">
            <label>Tipo doc</label>
            <div className="perfilInput">
              <IdCard size={16} />
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
                <option value="PASSPORT">PASSPORT</option>
              </select>
            </div>
          </div>

          <div className="perfilField">
            <label>N° doc</label>
            <div className="perfilInput">
              <IdCard size={16} />
              <input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="perfilField">
            <label>Celular</label>
            <div className="perfilInput">
              <Phone size={16} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="perfilField">
            <label>Dirección</label>
            <div className="perfilInput">
              <MapPin size={16} />
              <input
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
            </div>
          </div>

          <div className="perfilField">
            <label>Dirección extra</label>
            <div className="perfilInput">
              <MapPin size={16} />
              <input
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>
          </div>

          <div className="perfilField">
            <label>Departamento</label>
            <div className="perfilInput">
              <Landmark size={16} />
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setProvinceId("");
                  setDistrictId("");
                }}
              >
                <option value="">Selecciona</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="perfilField">
            <label>Provincia</label>
            <div className="perfilInput">
              <Landmark size={16} />
              <select
                value={provinceId}
                disabled={!departmentId}
                onChange={(e) => {
                  setProvinceId(e.target.value);
                  setDistrictId("");
                }}
              >
                <option value="">
                  {departmentId ? "Selecciona" : "Primero departamento"}
                </option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="perfilField">
            <label>Distrito</label>
            <div className="perfilInput">
              <Landmark size={16} />
              <select
                value={districtId}
                disabled={!provinceId}
                onChange={(e) => setDistrictId(e.target.value)}
              >
                <option value="">
                  {provinceId ? "Selecciona" : "Primero provincia"}
                </option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="perfilField perfilWide">
            <label>Referencia</label>
            <div className="perfilInput">
              <MapPin size={16} />
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej. Frente al parque"
              />
            </div>
          </div>

          {/* NEW: Colegio */}
          <div className="perfilField perfilWide">
            <label>Colegio (para descuentos)</label>
            <div className="perfilInput">
              <GraduationCap size={16} />
              <select
                value={colegioId}
                onChange={(e) => setColegioId(e.target.value)}
              >
                <option value="">— No especificar —</option>
                {colegios.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre_comercial || `Colegio #${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="perfilActions">
          <button
            className="perfilBtn"
            type="button"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="spin" size={16} /> Guardando…
              </>
            ) : (
              <>
                <Save size={16} /> Guardar
              </>
            )}
          </button>

          <a className="perfilLink" href={nextPath}>
            Volver
          </a>
        </div>

        {error && (
          <div className="perfilMsg isError">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {okMsg && <div className="perfilMsg isOk">{okMsg}</div>}
      </div>
    </div>
  );
}
