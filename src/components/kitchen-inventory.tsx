  import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Ingredient = { id:string; name:string; unit:'g'|'ml'|'pieces'; stock:number; low_stock:number };
type Recipe = { id:string; name:string; yield_unit:'kg'|'L'|'pieces'; base_yield:number };
type Part = { recipe_id:string; ingredient_id:string; quantity:number };
type Preparation = { id:string; recipe_name:string; quantity:number; unit:string; prepared_on:string; reversed_at:string|null };
// Tables are introduced by migration 0009; schema types can be regenerated after deployment.
const db = supabase as any;
const key = ['kitchen-admin'];
const amount = (v:string) => Number(v);
const displayQty=(n:number, unit:string) => unit==='g' && n>=1000 ? `${(n/1000).toFixed(3)} kg` : unit==='ml' && n>=1000 ? `${(n/1000).toFixed(3)} L` : `${n} ${unit}`;

export function KitchenInventory() {
  const queryClient = useQueryClient();
  const {data, isPending, error} = useQuery({queryKey:key, queryFn:async()=>{
    const tables=['pantry_ingredients','kitchen_recipes','kitchen_recipe_ingredients','kitchen_preparations'] as const;
    const results:any[]=await Promise.all(tables.map(t=>db.from(t).select('*')));
    const failed=results.find((r:any)=>r.error); if(failed) throw new Error(failed.error.message);
    return {ingredients:results[0].data as Ingredient[],recipes:results[1].data as Recipe[],parts:results[2].data as Part[],history:(results[3].data as Preparation[]).sort((a,b)=>b.prepared_on.localeCompare(a.prepared_on)).slice(0,40)};
  }});
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const [ingredientName,setIngredientName]=useState(''); const [unit,setUnit]=useState<'g'|'ml'|'pieces'>('g'); const [threshold,setThreshold]=useState('0');
  const [stockId,setStockId]=useState(''); const [stockAmt,setStockAmt]=useState(''); const [stockReason,setStockReason]=useState<'restock'|'adjustment'>('restock');
  const [recipeName,setRecipeName]=useState(''); const [yieldUnit,setYieldUnit]=useState<'kg'|'L'|'pieces'>('kg'); const [baseYield,setBaseYield]=useState('1');
  const [recipeId,setRecipeId]=useState(''); const [partIngredient,setPartIngredient]=useState(''); const [partQty,setPartQty]=useState('');
  const [partUnit,setPartUnit]=useState<'g'|'kg'|'ml'|'L'|'pieces'>('g');
  const [productionRecipe,setProductionRecipe]=useState(''); const [productionQty,setProductionQty]=useState(''); const [productionDate,setProductionDate]=useState(new Date().toLocaleDateString('en-CA'));
  async function act(work:()=>Promise<void>,success:string){setBusy(true);setMessage('');try{await work(); await queryClient.invalidateQueries({queryKey:key});setMessage(success);}catch(e){setMessage(e instanceof Error?e.message:'Operation failed');}finally{setBusy(false);}}
  if(isPending) return <section className="kitchen-admin"><h2>Kitchen Inventory</h2><p>Loading pantry…</p></section>;
  if(error || !data) return <section className="kitchen-admin"><h2>Kitchen Inventory</h2><p role="alert">{error?.message ?? 'Could not load inventory. Apply migration 0009 first.'}</p><button onClick={()=>queryClient.invalidateQueries({queryKey:key})}>Retry</button></section>;
  const {ingredients,recipes,parts,history}=data;
  const ingredientForRecipe = ingredients.find(i => i.id === partIngredient);
  const recipeInputUnit = ingredientForRecipe?.unit === 'g' ? (partUnit === 'kg' ? 'kg' : 'g') : ingredientForRecipe?.unit === 'ml' ? (partUnit === 'L' ? 'L' : 'ml') : 'pieces';
  const recipeStoredQty = amount(partQty) * (recipeInputUnit === 'kg' || recipeInputUnit === 'L' ? 1000 : 1);
  const recipeQtyValid = partQty.trim() !== '' && Number.isFinite(recipeStoredQty) && recipeStoredQty > 0;
  const selectedRecipe=recipes.find(r=>r.id===productionRecipe);
  const factor=selectedRecipe&&amount(productionQty)>0 ? amount(productionQty)/Number(selectedRecipe.base_yield) : 0;
  const planned=parts.filter(p=>p.recipe_id===productionRecipe).map(p=>{const i=ingredients.find(v=>v.id===p.ingredient_id);return {name:i?.name??'Unknown',unit:i?.unit??'',needed:Math.round(Number(p.quantity)*factor*1000)/1000,stock:Number(i?.stock??0)};});
  const canPrepare=!!selectedRecipe && factor>0 && planned.length>0 && planned.every(p=>p.needed>0&&p.stock>=p.needed);
  return <section className="kitchen-admin" aria-label="Kitchen Inventory">
    <p className="small-label">OWNER / KITCHEN OPERATIONS</p><h2>Kitchen Inventory</h2><p>Manage ingredients, recipes and daily preparation. Stock changes only when you confirm.</p>
    {message && <p role="status" className="form-message">{message}</p>}
    <div className="kitchen-panels">
      <div className="kitchen-panel"><h3>Pantry</h3>
        <table><thead><tr><th>Ingredient</th><th>Stock</th><th>Minimum</th></tr></thead><tbody>{ingredients.map(i=><tr key={i.id}><td>{i.name}</td><td className={Number(i.stock)<=Number(i.low_stock)?'kitchen-alert':''}>{displayQty(Number(i.stock),i.unit)}</td><td>{displayQty(Number(i.low_stock),i.unit)}</td></tr>)}</tbody></table>
        <form onSubmit={e=>{e.preventDefault();void act(async()=>{const {error}=await db.from('pantry_ingredients').insert({name:ingredientName.trim(),unit,low_stock:amount(threshold)});if(error)throw error;setIngredientName('');},'Ingredient added.');}}>
          <h4>Add ingredient</h4><label>Name<input required maxLength={100} value={ingredientName} onChange={e=>setIngredientName(e.target.value)}/></label>
          <label>Stock unit<select value={unit} onChange={e=>setUnit(e.target.value as typeof unit)}><option value="g">Grams (g)</option><option value="ml">Millilitres (ml)</option><option value="pieces">Pieces</option></select></label>
          <label>Low stock warning amount<input type="number" min="0" step="0.001" value={threshold} onChange={e=>setThreshold(e.target.value)} required/></label><button disabled={busy||!ingredientName.trim()}>Add to pantry</button>
        </form>
        <form onSubmit={e=>{e.preventDefault();void act(async()=>{const {error}=await db.rpc('kitchen_change_stock',{p_ingredient:stockId,p_delta:amount(stockAmt),p_reason:stockReason});if(error)throw error;setStockAmt('');},'Stock updated.');}}>
          <h4>Restock / correct stock</h4><label>Ingredient<select required value={stockId} onChange={e=>setStockId(e.target.value)}><option value="">Select ingredient</option>{ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
          <label>Type<select value={stockReason} onChange={e=>setStockReason(e.target.value as typeof stockReason)}><option value="restock">New purchase / restock</option><option value="adjustment">Correction (+ or −)</option></select></label>
          <label>Quantity in selected ingredient's unit<input required type="number" step="0.001" min={stockReason==='restock'?'0.001':undefined} value={stockAmt} onChange={e=>setStockAmt(e.target.value)}/></label>
          <button disabled={busy||!stockId||!Number.isFinite(amount(stockAmt))||amount(stockAmt)===0||(stockReason==='restock'&&amount(stockAmt)<0)}>Update stock</button>
        </form>
      </div>
      <div className="kitchen-panel"><h3>Recipe Builder</h3>
        <form onSubmit={e=>{e.preventDefault();void act(async()=>{const {error}=await db.from('kitchen_recipes').insert({name:recipeName.trim(),yield_unit:yieldUnit,base_yield:amount(baseYield)});if(error)throw error;setRecipeName('');},'Recipe created. Add its ingredients below.');}}>
          <label>Dish name<input required maxLength={100} value={recipeName} onChange={e=>setRecipeName(e.target.value)}/></label>
          <label>Prepared dish measured in<select value={yieldUnit} onChange={e=>setYieldUnit(e.target.value as typeof yieldUnit)}><option value="kg">Kilograms (kg)</option><option value="L">Litres (L)</option><option value="pieces">Pieces</option></select></label>
          <label>Base recipe yield<input required type="number" step="0.001" min="0.001" value={baseYield} onChange={e=>setBaseYield(e.target.value)}/></label><button disabled={busy||!recipeName.trim()||amount(baseYield)<=0}>Create recipe</button>
        </form>
        <form onSubmit={e=>{e.preventDefault();void act(async()=>{const {error}=await db.from('kitchen_recipe_ingredients').upsert({recipe_id:recipeId,ingredient_id:partIngredient,quantity:recipeStoredQty},{onConflict:'recipe_id,ingredient_id'});if(error)throw error;setPartQty('');},'Recipe ingredient saved.');}}>
          <h4>Set ingredients per base yield</h4>
          <label>Recipe<select required value={recipeId} onChange={e=>setRecipeId(e.target.value)}><option value="">Select recipe</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name} ({r.base_yield} {r.yield_unit})</option>)}</select></label>
          <label>Ingredient<select required value={partIngredient} onChange={e=>{const id=e.target.value;setPartIngredient(id);setPartUnit(ingredients.find(i=>i.id===id)?.unit ?? 'g');setPartQty('');}}><option value="">Select ingredient</option>{ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
          <label>Quantity<input required type="number" min="0.001" step="0.001" value={partQty} onChange={e=>setPartQty(e.target.value)}/></label>
          <label>Unit<select value={recipeInputUnit} onChange={e=>setPartUnit(e.target.value as typeof partUnit)}>
            {ingredientForRecipe?.unit === 'g' ? <><option value="g">Grams (g)</option><option value="kg">Kilograms (kg)</option></> : ingredientForRecipe?.unit === 'ml' ? <><option value="ml">Millilitres (ml)</option><option value="L">Litres (L)</option></> : <option value="pieces">Pieces</option>}
          </select></label>
          <button disabled={busy||!recipeId||!partIngredient||!recipeQtyValid}>Save ingredient quantity</button>
        </form>
        {recipes.map(r=><div key={r.id}><h4>{r.name} — {r.base_yield} {r.yield_unit}</h4><ul>{parts.filter(v=>v.recipe_id===r.id).map(part=><li key={part.ingredient_id}>{ingredients.find(i=>i.id===part.ingredient_id)?.name}: {displayQty(Number(part.quantity),ingredients.find(i=>i.id===part.ingredient_id)?.unit??'')}</li>)}</ul></div>)}
      </div>
      <div className="kitchen-panel"><h3>Daily Preparation</h3>
        <label>Recipe<select value={productionRecipe} onChange={e=>setProductionRecipe(e.target.value)}><option value="">Select recipe</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Quantity {selectedRecipe?`(${selectedRecipe.yield_unit})`:''}<input type="number" min="0.001" step="0.001" value={productionQty} onChange={e=>setProductionQty(e.target.value)}/></label>
        <label>Preparation date<input type="date" value={productionDate} onChange={e=>setProductionDate(e.target.value)}/></label>
        <h4>Ingredient deduction preview</h4>
        {planned.length ? <table><thead><tr><th>Ingredient</th><th>Need</th><th>Available</th></tr></thead><tbody>{planned.map(p=><tr key={p.name}><td>{p.name}</td><td className={p.needed>p.stock?'kitchen-alert':''}>{displayQty(p.needed,p.unit)}</td><td>{displayQty(p.stock,p.unit)}</td></tr>)}</tbody></table> : <p>Select a recipe with ingredients to see deductions.</p>}
        {planned.some(p=>p.needed>p.stock)&&<p className="kitchen-alert">Insufficient stock. Restock before confirming.</p>}
        <button disabled={busy||!canPrepare||!productionDate} onClick={()=>{if(!window.confirm('Confirm preparation and deduct these ingredients?'))return;void act(async()=>{const {error}=await db.rpc('kitchen_prepare',{p_recipe:productionRecipe,p_quantity:amount(productionQty),p_date:productionDate});if(error)throw error;setProductionQty('');},'Preparation recorded. Ingredients deducted.');}}>Confirm and deduct stock</button>
        <h4>Preparation history</h4>
        {history.length===0?<p>No preparations recorded yet.</p>:<table><tbody>{history.map(h=><tr key={h.id}><td>{h.prepared_on} — {h.recipe_name} ({h.quantity} {h.unit})</td><td>{h.reversed_at?'Reversed':<button disabled={busy} onClick={()=>{if(!window.confirm('Reverse this preparation and return ingredients to pantry?'))return;void act(async()=>{const {error}=await db.rpc('kitchen_reverse_preparation',{p_preparation:h.id});if(error)throw error;},'Preparation reversed.');}}>Undo</button>}</td></tr>)}</tbody></table>}
      </div>
    </div>
  </section>;
}
