'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateBR as formatDateBRGlobal } from '@/lib/format';
import styles from './DocumentsPanel.module.css';
import { ModalFrame } from './ui/ModalFrame';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { UIButton } from './ui/Button';
import { UISelect } from './ui/Select';

type DocumentItem = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  createdAt: string;
  folder?: string | null;
  tags?: string[] | null;
  uploadedBy?: { id: string; name: string; email: string } | null;
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function normalizeText(v: string | null | undefined) {
  return (v || '').toLowerCase().trim();
}

function parseErrorMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
    if (typeof parsed?.detail === 'string') return parsed.detail;
  } catch {}
  return raw || fallback;
}

function docCategory(doc: DocumentItem): 'PDF' | 'IMAGEM' | 'WORD' | 'PLANILHA' | 'OUTROS' {
  const mime = normalizeText(doc.mimeType);
  const name = normalizeText(doc.originalName);

  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (
    mime.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  ) {
    return 'IMAGEM';
  }
  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  ) {
    return 'WORD';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.csv')
  ) {
    return 'PLANILHA';
  }
  return 'OUTROS';
}

function docBadgeClass(category: ReturnType<typeof docCategory>) {
  if (category === 'PDF') return styles.badgePdf;
  if (category === 'IMAGEM') return styles.badgeImage;
  if (category === 'WORD') return styles.badgeWord;
  if (category === 'PLANILHA') return styles.badgeSheet;
  return styles.badgeOther;
}

function getFileExt(name: string) {
  const trimmed = (name || '').trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx <= 0 || idx === trimmed.length - 1) return '';
  return trimmed.slice(idx + 1).toLowerCase();
}

function fileBaseName(name: string) {
  const trimmed = (name || '').trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx <= 0) return trimmed.toLowerCase();
  return trimmed.slice(0, idx).toLowerCase();
}

function splitTags(input: string) {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

const FOLDER_OPTIONS = ['Geral', 'Processual', 'Contratos', 'Financeiro', 'Comprovantes'];

export default function DocumentsPanel({
  matterId,
  documents,
  canUpload = true,
  canEdit = true,
  canDelete = true,
  tenantTimeZone,
}: {
  matterId: string;
  documents: DocumentItem[];
  canUpload?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  tenantTimeZone?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string>('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PDF' | 'IMAGEM' | 'WORD' | 'PLANILHA' | 'OUTROS'>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [confirmDelete, setConfirmDelete] = useState<DocumentItem | null>(null);
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameOriginalName, setRenameOriginalName] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [metaDoc, setMetaDoc] = useState<DocumentItem | null>(null);
  const [metaFolder, setMetaFolder] = useState('Geral');
  const [metaTags, setMetaTags] = useState('');
  const [folderFilter, setFolderFilter] = useState<'ALL' | string>('ALL');
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const panelErrorId = `documents-panel-error-${matterId}`;

  const versions = useMemo(() => {
    const groups = new Map<string, DocumentItem[]>();
    for (const doc of documents) {
      const key = `${fileBaseName(doc.originalName)}.${getFileExt(doc.originalName)}`;
      const list = groups.get(key) || [];
      list.push(doc);
      groups.set(key, list);
    }

    const map = new Map<string, { version: number; total: number }>();
    groups.forEach((list) => {
      const ordered = [...list].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      ordered.forEach((doc, idx) => {
        map.set(doc.id, { version: idx + 1, total: ordered.length });
      });
    });
    return map;
  }, [documents]);

  const sorted = useMemo(() => {
    const base = [...documents];
    if (sortBy === 'oldest') {
      return base.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    if (sortBy === 'name') {
      return base.sort((a, b) => a.originalName.localeCompare(b.originalName, 'pt-BR'));
    }
    return base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [documents, sortBy]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    const tagNeedle = normalizeText(tagFilter);
    return sorted.filter((doc) => {
      const byType = typeFilter === 'ALL' ? true : docCategory(doc) === typeFilter;
      if (!byType) return false;
      const folder = doc.folder || 'Geral';
      if (folderFilter !== 'ALL' && folder !== folderFilter) return false;
      if (tagNeedle) {
        const tagsText = (doc.tags || []).join(' ').toLowerCase();
        if (!tagsText.includes(tagNeedle)) return false;
      }
      if (!q) return true;

      const haystack = normalizeText(
        `${doc.originalName} ${doc.mimeType} ${doc.uploadedBy?.name || ''} ${doc.uploadedBy?.email || ''}`,
      );
      return haystack.includes(q);
    });
  }, [sorted, query, typeFilter, folderFilter, tagFilter]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    documents.forEach((doc) => (doc.tags || []).forEach((t) => tags.add(t)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [documents]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, sortBy, folderFilter, tagFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function saveMeta() {
    if (!metaDoc) return;
    setErr('');
    setBusy(`meta:${metaDoc.id}`);
    try {
      const resp = await fetch(`/api/documents/${metaDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: metaFolder, tags: splitTags(metaTags) }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(parseErrorMessage(t, `Erro ao salvar pasta/tags (${resp.status})`));
      }
      setMetaDoc(null);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar pasta/tags.');
    } finally {
      setBusy(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr('');
    setBusy('upload');

    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set('file', file);

        const resp = await fetch(`/api/matters/${matterId}/documents`, {
          method: 'POST',
          body: fd,
        });

        if (!resp.ok) {
          const t = await resp.text().catch(() => '');
          throw new Error(parseErrorMessage(t, `Erro no upload (${resp.status})`));
        }
      }

      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao enviar documento(s).');
    } finally {
      setBusy(null);
    }
  }

  async function deleteDoc(id: string) {
    setErr('');
    setBusy(`del:${id}`);

    try {
      const resp = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(parseErrorMessage(t, `Erro ao excluir (${resp.status})`));
      }

      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao excluir documento.');
    } finally {
      setConfirmDelete(null);
      setBusy(null);
    }
  }

  async function renameDoc(id: string) {
    const nextName = renameValue.trim();
    if (!nextName) {
      setErr('Informe um nome válido para o arquivo.');
      return;
    }

    setErr('');
    setBusy(`rename:${id}`);
    try {
      const resp = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName: nextName }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(parseErrorMessage(t, `Erro ao renomear (${resp.status})`));
      }
      setRenameDocId(null);
      setRenameValue('');
      setRenameOriginalName('');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao renomear documento.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.helperBlock}>
          <div className={styles.helper}>
            Organize os documentos do caso sem sair da tela.
          </div>
          <div className={styles.kpis}>
            <span>{documents.length} arquivo(s)</span>
            <span>{documents.filter((d) => docCategory(d) === 'PDF').length} PDF</span>
          </div>
        </div>

        {canUpload ? (
          <label className={styles.primaryButton}>
            {busy === 'upload' ? 'Enviando…' : 'Enviar documento(s)'}
            <input
              type="file"
              multiple
              className={styles.fileInput}
              disabled={busy !== null}
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </label>
        ) : null}
      </div>

      <div className={styles.filtersPanel}>
        <div className={styles.filtersTitle}>Filtros</div>
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome, tipo ou usuário..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <UISelect
            className={styles.select}
            value={typeFilter}
            ariaLabel="Tipo de documento"
            ariaDescribedBy={err ? panelErrorId : undefined}
            onChange={(value) =>
              setTypeFilter(value as 'ALL' | 'PDF' | 'IMAGEM' | 'WORD' | 'PLANILHA' | 'OUTROS')
            }
            options={[
              { value: 'ALL', label: 'Todos os tipos' },
              { value: 'PDF', label: 'PDF' },
              { value: 'IMAGEM', label: 'Imagem' },
              { value: 'WORD', label: 'Word' },
              { value: 'PLANILHA', label: 'Planilha' },
              { value: 'OUTROS', label: 'Outros' },
            ]}
          />
          <UISelect
            className={styles.select}
            value={sortBy}
            ariaLabel="Ordenação"
            ariaDescribedBy={err ? panelErrorId : undefined}
            onChange={(value) => setSortBy(value as 'newest' | 'oldest' | 'name')}
            options={[
              { value: 'newest', label: 'Mais recentes' },
              { value: 'oldest', label: 'Mais antigos' },
              { value: 'name', label: 'Nome (A-Z)' },
            ]}
          />
          <UISelect
            className={styles.select}
            value={folderFilter}
            ariaLabel="Pasta"
            ariaDescribedBy={err ? panelErrorId : undefined}
            onChange={setFolderFilter}
            options={[
              { value: 'ALL', label: 'Todas as pastas' },
              ...FOLDER_OPTIONS.map((folder) => ({ value: folder, label: folder })),
            ]}
          />
          <input
            className={styles.searchInput}
            placeholder="Filtrar por tag..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            list={`tags-${matterId}`}
          />
          <UIButton
            type="button"
            className={styles.clearFiltersButton}
            onClick={() => {
              setQuery('');
              setTypeFilter('ALL');
              setSortBy('newest');
              setFolderFilter('ALL');
              setTagFilter('');
            }}
            variant="ghost"
          >
            Limpar
          </UIButton>
        </div>
        <datalist id={`tags-${matterId}`}>
          {allTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>

      {err ? (
        <div id={panelErrorId} className={styles.error}>
          {err}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          Nenhum documento enviado.
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {paginated.map((doc) => {
            const category = docCategory(doc);
            const version = versions.get(doc.id);
            return (
            <div key={doc.id} className={styles.item}>
              <div className={styles.meta}>
                <div className={styles.filenameRow}>
                  <div className={styles.filename}>{doc.originalName}</div>
                  <span className={`${styles.badge} ${docBadgeClass(category)}`}>{category}</span>
                  {version ? (
                    <span className={`${styles.badge} ${styles.badgeVersion}`}>
                      v{version.version}{version.total > 1 ? `/${version.total}` : ''}
                    </span>
                  ) : null}
                  <span className={`${styles.badge} ${styles.badgeFolder}`}>
                    {doc.folder || 'Geral'}
                  </span>
                </div>
                <div className={styles.metaLine}>
                  {doc.mimeType} · {formatBytes(doc.sizeBytes)} · {formatDateBRGlobal(doc.createdAt, tenantTimeZone)}
                </div>
                {(doc.tags || []).length > 0 ? (
                  <div className={styles.tagsRow}>
                    {(doc.tags || []).map((tag) => (
                      <span key={`${doc.id}-${tag}`} className={styles.tagItem}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {doc.uploadedBy ? (
                  <div className={styles.metaSub}>
                    Enviado por {doc.uploadedBy.name} ({doc.uploadedBy.email})
                  </div>
                ) : null}
              </div>

              <div className={styles.actions}>
                {category === 'PDF' || category === 'IMAGEM' ? (
                  <UIButton
                    className={styles.ghostButton}
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    variant="ghost"
                    size="sm"
                  >
                    Prévia
                  </UIButton>
                ) : null}
                <UIButton href={`/api/documents/${doc.id}/download`} className={styles.ghostButton} variant="ghost" size="sm">
                  Baixar
                </UIButton>

                {canEdit ? (
                  <>
                    <UIButton
                      className={styles.ghostButton}
                      disabled={busy !== null}
                      onClick={() => {
                        setRenameDocId(doc.id);
                        setRenameValue(doc.originalName);
                        setRenameOriginalName(doc.originalName);
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      Renomear
                    </UIButton>
                    <UIButton
                      className={styles.ghostButton}
                      type="button"
                      onClick={() => {
                        setMetaDoc(doc);
                        setMetaFolder(doc.folder || 'Geral');
                        setMetaTags((doc.tags || []).join(', '));
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      Pasta/Tags
                    </UIButton>
                  </>
                ) : null}

                {canDelete ? (
                  <UIButton
                    className={styles.dangerButton}
                    disabled={busy !== null}
                    onClick={() => setConfirmDelete(doc)}
                    variant="danger"
                    size="sm"
                  >
                    {busy === `del:${doc.id}` ? 'Excluindo…' : 'Excluir'}
                  </UIButton>
                ) : null}
              </div>
            </div>
          );
            })}
          </div>
          <div className={styles.paginationRow}>
            <span className={styles.paginationInfo}>
              Exibindo {startIndex}-{endIndex} de {totalItems}
            </span>
            <div className={styles.paginationControls}>
              <label className={styles.paginationLabel}>
                Itens:
                <UISelect
                  className={styles.paginationSelect}
                  value={String(pageSize)}
                  ariaLabel="Itens por página"
                  ariaDescribedBy={err ? panelErrorId : undefined}
                  onChange={(value) => setPageSize(Number(value))}
                  options={[
                    { value: '10', label: '10' },
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                  ]}
                />
              </label>
              <UIButton
                type="button"
                className={styles.ghostButton}
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                variant="ghost"
              >
                Anterior
              </UIButton>
              <span className={styles.paginationInfo}>Página {currentPage} de {totalPages}</span>
              <UIButton
                type="button"
                className={styles.ghostButton}
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                variant="ghost"
              >
                Próxima
              </UIButton>
            </div>
          </div>
        </>
      )}

      {canEdit && renameDocId ? (
        <ModalFrame open onClose={() => {
          setRenameDocId(null);
          setRenameOriginalName('');
        }}>
          <div>
            <h3 className={styles.modalTitle}>Renomear documento</h3>
            <input
              className={styles.searchInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Novo nome do arquivo"
            />
            {(() => {
              const oldExt = getFileExt(renameOriginalName);
              const newExt = getFileExt(renameValue);
              const changed = !!oldExt && !!newExt && oldExt !== newExt;
              if (!changed) return null;
              return (
                <div className={styles.renameWarning}>
                  Extensão alterada de <b>.{oldExt}</b> para <b>.{newExt}</b>. O arquivo físico não muda,
                  apenas o nome exibido.
                </div>
              );
            })()}
            <div className={styles.modalActions}>
              <UIButton
                className={styles.ghostButton}
                onClick={() => {
                  setRenameDocId(null);
                  setRenameOriginalName('');
                }}
                variant="ghost"
              >
                Cancelar
              </UIButton>
              <UIButton
                className={styles.primaryButton}
                onClick={() => renameDoc(renameDocId)}
                disabled={busy !== null}
                variant="primary"
              >
                {busy === `rename:${renameDocId}` ? 'Salvando...' : 'Salvar nome'}
              </UIButton>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {canEdit && metaDoc ? (
        <ModalFrame open onClose={() => setMetaDoc(null)}>
          <div>
            <h3 className={styles.modalTitle}>Pasta e tags</h3>
            <p className={styles.modalText}><b>{metaDoc.originalName}</b></p>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Pasta</span>
                <UISelect
                  className={styles.select}
                  value={metaFolder}
                  ariaLabel="Pasta"
                  ariaDescribedBy={err ? panelErrorId : undefined}
                  onChange={setMetaFolder}
                  options={FOLDER_OPTIONS.map((folder) => ({ value: folder, label: folder }))}
                />
              </label>
              <label className={styles.formField}>
                <span>Tags (separadas por vírgula)</span>
                <input
                  className={styles.searchInput}
                  value={metaTags}
                  onChange={(e) => setMetaTags(e.target.value)}
                  placeholder="ex: peticao, urgencia, cliente"
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <UIButton className={styles.ghostButton} onClick={() => setMetaDoc(null)} variant="ghost">
                Cancelar
              </UIButton>
              <UIButton className={styles.primaryButton} onClick={saveMeta} variant="primary">
                Salvar
              </UIButton>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {previewDoc ? (
        <ModalFrame open onClose={() => setPreviewDoc(null)} size="lg">
          <div className={styles.previewModal}>
            <h3 className={styles.modalTitle}>Pré-visualização</h3>
            <p className={styles.modalText}>{previewDoc.originalName}</p>
            <div className={styles.previewArea}>
              {docCategory(previewDoc) === 'PDF' ? (
                <iframe
                  title={`preview-${previewDoc.id}`}
                  src={`/api/documents/${previewDoc.id}/view`}
                  className={styles.previewFrame}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/documents/${previewDoc.id}/view`}
                  alt={previewDoc.originalName}
                  className={styles.previewImage}
                />
              )}
            </div>
            <div className={styles.modalActions}>
              <UIButton href={`/api/documents/${previewDoc.id}/download`} className={styles.ghostButton} variant="ghost">
                Baixar
              </UIButton>
              <UIButton className={styles.primaryButton} onClick={() => setPreviewDoc(null)} variant="primary">
                Fechar
              </UIButton>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {canDelete && confirmDelete ? (
        <ConfirmDialog
          open
          title="Excluir documento"
          description={
            <>
              Tem certeza que deseja excluir <b>{confirmDelete.originalName}</b>?
            </>
          }
          confirmLabel={busy === `del:${confirmDelete.id}` ? 'Excluindo…' : 'Confirmar exclusão'}
          confirmTone="danger"
          busy={busy !== null}
          error={err}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => deleteDoc(confirmDelete.id)}
        />
      ) : null}
    </div>
  );
}
