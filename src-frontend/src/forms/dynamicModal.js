import DynamicForm from "./dynamicForms";
import {X} from 'lucide-react';


export default function DynamicModal({setModalState, children}) {

    const handleClick = (event) => {
        // Ensure the click is on the background, not on a child element
        if (event.target === event.currentTarget) {
            setModalState(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white/80 dark:bg-black/80 flex items-center justify-center" onClick={handleClick}>
            <div className="w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2">
                <X className="relative top-0 right-0 m-4 cursor-pointer" onClick={() => setModalState(false)}/>
                {children}
            </div>
        </div>
    )
}