import { Spinner } from "../../components/Spinner";

export function SaveButtons({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void })
{
    return (
        <>
            <button type="button" className="btn-ghost" disabled={!dirty || saving} onClick={onReset}>Discard</button>
            <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={onSave}>{saving && <Spinner />}Save changes</button>
        </>
    );
}
