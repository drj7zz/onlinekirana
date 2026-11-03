import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CircleCheck, CircleX, Leaf, Boxes } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import ImageUpload from '@shared/components/ImageUpload';
import SmartImage from '@shared/components/SmartImage';
import { SkeletonRows } from '@shared/components/Skeletons';
import { useToast } from '@shared/context/ToastContext';
import { imageUrl } from '@shared/api';
import WorkspaceHeader from '../components/WorkspaceHeader.jsx';

const empty = { name: '', category: '', price: '', unit: 'kg', stock: '', imageUrl: '', discountPercent: 0, description: '' };
const inventoryKey = (userId) => `ok_partner_inventory_v1_${userId}`;
const isLocalDraft = (product) => Boolean(product.localId);

const statusIcon = { pending: <Clock size={14} color="var(--warning-accent)" />, approved: <CircleCheck size={14} color="var(--success)" />, rejected: <CircleX size={14} color="var(--danger)" /> };
const statusLabel = { pending: 'Pending review', approved: 'Live in shop', rejected: 'Not approved' };

/**
 * One catalogue row. Photo thumbnails give the list a face; edit/delete sit on
 * the right so the row reads "what it is → what you can do with it".
 */
function ProductRow({ p, onEdit, onDelete, busy }) {
  const draft = isLocalDraft(p);
  return (
    <div className="prod-row">
      <div className="prod-row-media">
        <SmartImage
          src={imageUrl(p.imageUrl)}
          alt=""
          imgCls="prod-row-thumb"
          fallbackCls="prod-row-thumb prod-row-thumb-fallback"
          fallback={<Leaf size={18} aria-hidden="true" />}
        />
      </div>
      <div className="prod-row-main">
        <strong>{p.name}</strong>
        <span className="muted">{p.category} · रू {Number(p.price).toLocaleString('en-IN')}/{p.unit} · stock {p.stock}</span>
      </div>
      <span className={`status ${draft ? 's-pending' : `s-${p.status}`}`}>
        {draft ? <Clock size={14} aria-hidden="true" /> : statusIcon[p.status]}
        {draft ? 'Saved on this device' : statusLabel[p.status]}
      </span>
      <div className="prod-row-actions">
        <button className="muted-btn" disabled={busy === (p.localId || p._id)} onClick={() => onEdit(p)}>Edit</button>
        <button className="danger" disabled={busy === (p.localId || p._id)} onClick={() => onDelete(p.localId || p._id)}>Delete</button>
      </div>
    </div>
  );
}

/** Merchant product catalogue: submit, edit and retire what this shop sells. */
export default function Products() {
  const { user } = useAuth();
  const merchantId = user?._id;
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [inventoryState, setInventoryState] = useState({ userId: null, items: [] });
  const [syncing, setSyncing] = useState(false);

  const storedInventory = useMemo(() => {
    if (!merchantId) return { items: [], error: '', loaded: false };
    try {
      const saved = localStorage.getItem(inventoryKey(merchantId));
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed) || parsed.some((item) => (
        !item
        || typeof item !== 'object'
        || typeof item.localId !== 'string'
        || !item.localId.startsWith('local:')
        || typeof item.name !== 'string'
        || typeof item.category !== 'string'
      ))) throw new Error('Saved inventory contains invalid product data.');
      return { items: parsed, error: '', loaded: true };
    } catch (loadError) {
      return {
        items: [],
        error: loadError instanceof SyntaxError
          ? 'Saved inventory could not be read. It has been left untouched; clear this browser storage only if you no longer need those drafts.'
          : 'Saved inventory could not be loaded from this device. It has been left untouched.',
        loaded: true,
      };
    }
  }, [merchantId]);
  const inventory = inventoryState.userId === merchantId ? inventoryState.items : storedInventory.items;
  const inventoryLoaded = storedInventory.loaded;

  const load = () => {
    API.get('/partner/products')
      .then((r) => setProducts(r.data))
      .catch(() => setError('We could not load your products right now. Please try again.'))
      .finally(() => setLoading(false));
  };
  useLive(load, 8000, [user?._id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveInventory = (items) => {
    if (storedInventory.error) {
      setError(storedInventory.error);
      return false;
    }
    try {
      localStorage.setItem(inventoryKey(merchantId), JSON.stringify(items));
      setInventoryState({ userId: merchantId, items });
      setError('');
      return true;
    } catch {
      setError('Could not save this inventory on your device. Check available browser storage and try again.');
      return false;
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, price: +form.price, stock: +form.stock, discountPercent: +form.discountPercent || 0 };
    const localId = editId?.startsWith('local:') ? editId : `local:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const draft = { ...payload, localId, productId: editId && !editId.startsWith('local:') ? editId : undefined, savedAt: new Date().toISOString() };
    const next = editId?.startsWith('local:')
      ? inventory.map((item) => item.localId === editId ? draft : item)
      : [...inventory, draft];
    if (saveInventory(next)) {
      setForm(empty); setEditId(null);
      toast.success('Saved to this device. Sync it when you are ready to submit for review.');
    }
  };

  const syncInventory = async () => {
    if (!inventory.length || syncing) return;
    setSyncing(true);
    setError('');
    const remaining = [];
    let synced = 0;
    for (const draft of inventory) {
      try {
        const { localId: _localId, productId, savedAt: _savedAt, ...payload } = draft;
        if (productId) await API.put(`/partner/products/${productId}`, payload);
        else await API.post('/partner/products', payload);
        synced += 1;
      } catch (syncError) {
        remaining.push(draft);
        if (!syncError.response) {
          remaining.push(...inventory.slice(inventory.indexOf(draft) + 1));
          break;
        }
      }
    }
    const stored = saveInventory(remaining);
    setSyncing(false);
    if (synced) {
      load();
      toast.success(`${synced} product${synced === 1 ? '' : 's'} synced and submitted for approval`);
    }
    if (!stored || remaining.length) {
      setError(`${synced} synced; ${remaining.length} kept on this device because they could not be submitted. Review the saved inventory and try again.`);
    }
  };

  const del = async (id) => {
    setBusyId(id);
    if (id.startsWith('local:')) {
      if (confirm('Remove this saved inventory item from this device?')) {
        saveInventory(inventory.filter((item) => item.localId !== id));
      }
      setBusyId(null);
      return;
    }
    if (confirm('Remove this product?')) {
      try { await API.delete(`/partner/products/${id}`); load(); toast.success('Product removed'); }
      catch { setError('Could not remove that product.'); toast.error('Could not remove that product'); }
    }
    setBusyId(null);
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to manage your products.</p>;
  if (user.role !== 'merchant') return <p className="empty">The product catalogue is for merchant partners only.</p>;
  if (user.merchantStatus !== 'approved') {
    return (
      <div className="empty">
        <h1>{user.shopName}</h1>
        <p>Your partner account is <strong>{user.merchantStatus}</strong>. New partner shops are reviewed before they go live. You&apos;ll be able to list products once approved.</p>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        icon={Boxes}
        eyebrow="Merchant workspace"
        title="My products"
        description="Add and update what your shop sells. New items go live once the operations desk approves them."
      />

      {/* The add/edit form is a card so it reads as one unit; paired numeric
          fields share rows to keep it short. */}
      <details className="workspace-disclosure inventory-form-disclosure" open>
        <summary><span><Boxes size={17} aria-hidden="true" />{editId ? 'Edit inventory item' : 'Add to inventory'}</span><small>Saved on this device until you sync for approval</small></summary>
        <form className="form workspace-disclosure-body" onSubmit={submit}>
          <label>Name<input required value={form.name} onChange={set('name')} /></label>
          <label>Category<input required value={form.category} onChange={set('category')} /></label>
          <div className="field-row">
            <label>Price (NPR)<input type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} /></label>
            <label>Stock<input type="number" min="0" required value={form.stock} onChange={set('stock')} /></label>
          </div>
          <div className="field-row">
            <label>Unit
              <select value={form.unit} onChange={set('unit')}>
                {['kg', 'litre', 'packet', 'piece', 'dori', 'gatta'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>Discount %<input type="number" min="0" max="90" value={form.discountPercent} onChange={set('discountPercent')} /></label>
          </div>
          <label>Product photo</label>
          <ImageUpload endpoint="/uploads/product" value={form.imageUrl} size={104}
            label="Upload photo" onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
          <label>Description<textarea value={form.description} onChange={set('description')} /></label>
          {(error || storedInventory.error) && <p className="error">{error || storedInventory.error}</p>}
          <div className="profile-actions">
            <button type="submit" className="cta-btn">{editId ? 'Save inventory changes' : 'Save to inventory'}</button>
            {editId && <button type="button" className="muted-btn" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</button>}
          </div>
        </form>
      </details>

      <details className="workspace-disclosure inventory-saved-disclosure" open={inventory.length > 0}>
        <summary><span>Saved on this device</span><small>{inventory.length} product{inventory.length === 1 ? '' : 's'} · sync to request approval</small></summary>
        <div className="workspace-disclosure-body">
          {!inventoryLoaded ? <p className="muted">Loading saved inventory…</p> : inventory.length === 0 ? (
            <p className="empty">Inventory saved on this device will appear here.</p>
          ) : (
            <>
              <div className="inventory-sync-row">
                <p className="muted">Sync submits saved products to the operations desk for approval.</p>
                <button type="button" className="cta-btn" onClick={syncInventory} disabled={syncing || !navigator.onLine}>
                  {syncing ? 'Syncing…' : `Sync ${inventory.length} for approval`}
                </button>
              </div>
              <div className="prod-rows">
                {inventory.map((item) => (
                  <ProductRow key={item.localId} p={{ ...item, status: 'pending' }} busy={busyId} onEdit={(draft) => {
                    setEditId(draft.localId);
                    setForm({ name: draft.name, category: draft.category, price: draft.price, unit: draft.unit, stock: draft.stock, imageUrl: draft.imageUrl || '', discountPercent: draft.discountPercent || 0, description: draft.description || '' });
                    document.querySelector('.inventory-form-disclosure')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }} onDelete={del} />
                ))}
              </div>
            </>
          )}
        </div>
      </details>

      <details className="workspace-disclosure">
        <summary><span>Submitted catalogue</span><small>{products.length} product{products.length === 1 ? '' : 's'}</small></summary>
        <div className="workspace-disclosure-body">
          {loading ? <SkeletonRows n={4} cols={3} /> : products.length === 0 ? (
            <p className="empty">No products have been submitted yet.</p>
          ) : (
            <div className="prod-rows">
              {products.map((p) => (
                <ProductRow key={p._id} p={p} busy={busyId}
                  onEdit={(prod) => { setEditId(prod._id); setForm({ name: prod.name, category: prod.category, price: prod.price, unit: prod.unit, stock: prod.stock, imageUrl: prod.imageUrl, discountPercent: prod.discountPercent, description: prod.description }); document.querySelector('.inventory-form-disclosure')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  onDelete={del}
                />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
