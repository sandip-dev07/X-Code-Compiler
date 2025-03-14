// Import icons from react-icons
import { SiCplusplus, SiJavascript, SiPython } from "react-icons/si";
import { SiRuby, SiGo, SiRust, SiPhp } from "react-icons/si";
import { BiSolidData } from "react-icons/bi";
import { FaJava } from "react-icons/fa";
import { TbBrandCSharp } from "react-icons/tb";

export const languageIcons = {
  cpp: <SiCplusplus className="mr-2 h-4 w-4 text-blue-500" />,
  javascript: <SiJavascript className="mr-2 h-4 w-4 text-yellow-400" />,
  python: <SiPython className="mr-2 h-4 w-4 text-blue-600" />,
  java: <FaJava className="mr-2 h-4 w-4 text-red-500" />,
  csharp: <TbBrandCSharp className="mr-2 h-4 w-4 text-purple-600" />,
  ruby: <SiRuby className="mr-2 h-4 w-4 text-red-600" />,
  go: <SiGo className="mr-2 h-4 w-4 text-cyan-500" />,
  rust: <SiRust className="mr-2 h-4 w-4 text-orange-600" />,
  php: <SiPhp className="mr-2 h-4 w-4 text-indigo-500" />,
  sql: <BiSolidData className="mr-2 h-4 w-4 text-green-500" />,
};
