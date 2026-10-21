import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/client';
import type { MasterDataOverview } from '../lib/api';

type Props = { token: string; branchId: string; onNotice: (message: string) => void; onError: (message: string) => void };

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function MasterDataPanel({ token, branchId, onNotice, onError }: Props) {
  const [data, setData] = useState<MasterDataOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'menu'>('ingredients');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [ingredientName, setIngredientName] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('kg');
  const [stockUnit, setStockUnit] = useState('g');
  const [conversion, setConversion] = useState(1000);
  const [cost, setCost] = useState(0);
  const [versionPrice, setVersionPrice] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 16));
  const [modifierName, setModifierName] = useState('');
  const [modifierOptions, setModifierOptions] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

  async function load() {
    setLoading(true);

    try { setData(await api.masterData(token, branchId)); } catch (error) { onError(error instanceof Error ? error.message : 'Không tải được master data.'); } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [token, branchId]);
  const selectedItem = data?.menuItems.find((item) => item.id === selectedItemId) ?? data?.menuItems[0];
  const selectedRecipe = data?.recipes.find((recipe) => recipe.menuItemId === selectedItem?.id && recipe.status === 'PUBLISHED') ?? data?.recipes.find((recipe) => recipe.menuItemId === selectedItem?.id);
  const categoryName = (id: string) => data?.categories.find((category) => category.id === id)?.name ?? 'Chưa phân nhóm';
  const ingredientNameFor = (id: string) => data?.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id;
  const publishedCount = useMemo(() => data?.menuItems.filter((item) => item.status === 'PUBLISHED').length ?? 0, [data]);

  async function createIngredient(event: FormEvent) {
    event.preventDefault();

    try { await api.createIngredient(token, { name: ingredientName, purchaseUnit, stockUnit, purchaseToStock: conversion, standardCost: cost }); setIngredientName(''); setShowIngredientForm(false); await load(); onNotice('Ingredient đã được thêm với canonical stock unit.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể thêm ingredient.'); }
  }

  async function publishMenu() {
    if (!selectedItem) return;

    try { await api.publishMenuItem(token, selectedItem.id); await load(); onNotice(`Đã publish ${selectedItem.name} thành version menu mới.`); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể publish menu item.'); }
  }

  async function createMenuVersion(event: FormEvent) { event.preventDefault();

 if (!selectedItem) return;

 try { await api.createMenuVersion(token, { menuItemId: selectedItem.id, price: versionPrice || selectedItem.price, effectiveFrom: new Date(effectiveFrom).toISOString() }); await load(); onNotice('Draft menu version đã được tạo; publish để áp dụng vào availability.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể tạo menu version.'); } }

  async function createModifier(event: FormEvent) { event.preventDefault();

 if (!selectedItem || !modifierName.trim() || !modifierOptions.trim()) return;

 try { await api.createModifierGroup(token, { menuItemId: selectedItem.id, name: modifierName.trim(), options: modifierOptions.split(',').map((label) => ({ label: label.trim() })).filter((option) => option.label) }); setModifierName(''); setModifierOptions(''); await load(); onNotice('Modifier group đã được thêm.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể thêm modifier.'); } }

  async function saveAllergens() { if (!selectedItem) return;

 try { await api.setMenuItemAllergens(token, selectedItem.id, selectedAllergens); await load(); onNotice('Allergen declaration đã được cập nhật.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể cập nhật allergen.'); } }

  async function toggleAvailability() { if (!selectedItem) return; const status = selectedItem.status === 'UNAVAILABLE' ? 'PUBLISHED' : 'UNAVAILABLE';

 try { await api.setMenuItemAvailability(token, selectedItem.id, { status }); await load(); onNotice(status === 'PUBLISHED' ? 'Menu item đã mở bán.' : 'Menu item đã tạm ngưng bán.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể cập nhật availability.'); } }

  if (loading) return <section className="workspace-loading" aria-live="polite"><span className="spinner" />Đang tải BOH master data…</section>;

  if (!data) return <section className="empty-state"><strong>Chưa có master data</strong><span>Kiểm tra branch scope hoặc thử tải lại.</span></section>;

  return <section className="operations-view" aria-labelledby="master-title">
    <div className="view-header"><div><span className="micro-label">WEEK 04 · BOH SOURCE OF TRUTH</span><h1 id="master-title">Master data studio</h1><p>Chuẩn hóa ingredient, menu version và recipe station trước khi nối purchasing với stock ledger.</p></div><div className="view-summary"><strong>{data.ingredients.length + data.menuItems.length}</strong><span>records đang quản lý</span></div></div>
    <div className="master-kpis"><div><span>Ingredients</span><strong>{data.ingredients.length}</strong><small>Canonical conversion</small></div><div><span>Menu items</span><strong>{data.menuItems.length}</strong><small>{publishedCount} published</small></div><div><span>Recipes</span><strong>{data.recipes.length}</strong><small>Versioned by station</small></div><div><span>Suppliers</span><strong>{data.suppliers.length}</strong><small>Purchasing ready</small></div></div>
    <div className="master-tabs" role="tablist" aria-label="BOH master data"><button className={activeTab === 'ingredients' ? 'master-tab active' : 'master-tab'} role="tab" aria-selected={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')}>Ingredients & units</button><button className={activeTab === 'menu' ? 'master-tab active' : 'master-tab'} role="tab" aria-selected={activeTab === 'menu'} onClick={() => setActiveTab('menu')}>Menu & recipes</button></div>
    {activeTab === 'ingredients' ? <section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">BOH INVENTORY INPUT</span><h2>Ingredients & canonical units</h2></div><button className="button button-secondary" onClick={() => setShowIngredientForm((value) => !value)}>{showIngredientForm ? 'Đóng form' : 'Thêm ingredient'}</button></div><p className="section-lede">Conversion phải lớn hơn 0; stock mutation về sau chỉ dùng stock unit để tránh lệch kg/g. Unit hợp lệ: {data.units.map((unit) => unit.code).join(' · ')}.</p>{showIngredientForm && <form className="master-form" onSubmit={createIngredient}><label>Tên ingredient<input value={ingredientName} onChange={(event) => setIngredientName(event.target.value)} placeholder="Ví dụ: Sữa tươi" required minLength={2} /></label><label>Purchase unit<select value={purchaseUnit} onChange={(event) => setPurchaseUnit(event.target.value)}>{data.units.map((unit) => <option key={unit.code}>{unit.code}</option>)}</select></label><label>Stock unit<select value={stockUnit} onChange={(event) => setStockUnit(event.target.value)}>{data.units.map((unit) => <option key={unit.code}>{unit.code}</option>)}</select></label><label>Quy đổi<input type="number" min="0.000001" step="0.001" value={conversion} onChange={(event) => setConversion(Number(event.target.value))} required /></label><label>Standard cost<input type="number" min="0" step="100" value={cost} onChange={(event) => setCost(Number(event.target.value))} required /></label><button className="button button-primary">Lưu master record</button></form>}<div className="table-wrap"><table className="data-table"><caption className="sr-only">Danh sách ingredient và quy đổi đơn vị</caption><thead><tr><th>Ingredient</th><th>Purchase</th><th>Canonical stock</th><th>Standard cost</th><th>Status</th></tr></thead><tbody>{data.ingredients.map((ingredient) => <tr key={ingredient.id}><td><strong>{ingredient.name}</strong><small>{ingredient.id}</small></td><td>{ingredient.purchaseUnit}</td><td><strong>1 {ingredient.purchaseUnit} = {ingredient.purchaseToStock} {ingredient.stockUnit}</strong></td><td>{money.format(ingredient.standardCost)}</td><td><span className="status-badge status-active">{ingredient.status}</span></td></tr>)}</tbody></table></div></section> : <div className="master-layout"><section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">MENU CATALOG</span><h2>Menu version</h2></div><span className="data-count">{data.menuItems.length} món</span></div><div className="menu-list">{data.menuItems.map((item) => <button className={`menu-row ${selectedItem?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setSelectedItemId(item.id); setSelectedAllergens(item.allergenCodes); setVersionPrice(item.price); }}>{<span className={`station-marker station-${item.stationCode.toLowerCase()}`} />}<span className="menu-copy"><strong>{item.name}</strong><small>{categoryName(item.categoryId)} · {item.stationCode}</small></span><span className="menu-price">{money.format(item.price)}</span><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status}</span></button>)}</div></section><section className="panel data-panel recipe-detail"><div className="section-heading"><div><span className="micro-label">RECIPE LINEAGE</span><h2>{selectedItem?.name ?? 'Chọn menu item'}</h2></div><div className="button-row">{selectedItem && selectedItem.status === 'UNAVAILABLE' && <button className="button button-secondary" onClick={toggleAvailability}>Mở bán</button>}{selectedItem && selectedItem.status === 'PUBLISHED' && <button className="button button-secondary" onClick={toggleAvailability}>Tạm ngưng</button>}{selectedItem && selectedItem.status !== 'PUBLISHED' && <button className="button button-primary" onClick={publishMenu}>Publish menu</button>}</div></div>{selectedItem ? <><p className="section-lede">{selectedItem.description || 'Chưa có mô tả'} · Station <strong>{selectedItem.stationCode}</strong> · Availability <strong>{selectedItem.status}</strong></p><div className="version-block"><span className="micro-label">MENU VERSIONS</span>{data.menuVersions.filter((version) => version.menuItemId === selectedItem.id).map((version) => <div className="version-heading" key={version.id}><strong>Version {version.version} · {money.format(version.price)}</strong><span>{new Date(version.effectiveFrom).toLocaleString('vi-VN')} · {version.status}</span></div>)}<form className="master-form compact-form" onSubmit={createMenuVersion}><label>Giá version<input type="number" min="0" value={versionPrice || selectedItem.price} onChange={(event) => setVersionPrice(Number(event.target.value))} required /></label><label>Effective from<input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required /></label><button className="button button-secondary">Tạo draft version</button></form></div><div className="version-block"><span className="micro-label">ALLERGEN REGISTRY</span><div className="checkbox-grid">{data.allergens.map((allergen) => <label key={allergen.code}><input type="checkbox" checked={selectedAllergens.includes(allergen.code)} onChange={(event) => setSelectedAllergens((current) => event.target.checked ? [...current, allergen.code] : current.filter((code) => code !== allergen.code))} />{allergen.label}</label>)}</div><button className="button button-secondary" onClick={saveAllergens}>Lưu allergen declaration</button></div><div className="version-block"><span className="micro-label">MODIFIERS</span>{data.modifierGroups.filter((group) => group.menuItemId === selectedItem.id).map((group) => <div className="version-heading" key={group.id}><strong>{group.name}{group.required ? ' · bắt buộc' : ''}</strong><span>{group.options.map((option) => `${option.label}${option.priceDelta ? ` (+${money.format(option.priceDelta)})` : ''}`).join(' · ')}</span></div>)}<form className="master-form compact-form" onSubmit={createModifier}><label>Tên group<input value={modifierName} onChange={(event) => setModifierName(event.target.value)} placeholder="Ví dụ: Size" required /></label><label>Options, phân tách bằng dấu phẩy<input value={modifierOptions} onChange={(event) => setModifierOptions(event.target.value)} placeholder="Nhỏ, Vừa, Lớn" required /></label><button className="button button-secondary">Thêm modifier group</button></form></div><div className="version-block"><span className="micro-label">CURRENT RECIPE</span>{selectedRecipe ? <><div className="version-heading"><strong>Version {selectedRecipe.version}</strong><span className={`status-badge status-${selectedRecipe.status.toLowerCase()}`}>{selectedRecipe.status}</span></div><div className="recipe-lines">{selectedRecipe.lines.map((line) => <div className="recipe-line" key={line.ingredientId}><span>{ingredientNameFor(line.ingredientId)}</span><strong>{line.quantity} {line.unit}{line.canonicalQuantity ? ` · canonical ${line.canonicalQuantity}` : ''}</strong></div>)}</div></> : <div className="empty-inline">Chưa có recipe version · chưa được phép nối vào theoretical usage.</div>}</div></> : <div className="empty-state"><strong>Chọn một menu item</strong></div>}</section></div>}
  </section>;
}
