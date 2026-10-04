import os
path = r'e:\MY Aplication\3rd Step\88-website\opay-client\src\BankTransferModal.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace activeBanks
content = content.replace(
    "const activeBanks = supportedBanks.filter(b => b.status !== 'inactive');",
    "const [bankSearch, setBankSearch] = useState('');\n  const activeBanks = supportedBanks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));"
)

# Add search input
old_menu = """                   {/* Dropdown Menu */}
                   {isDropdownOpen && (
                     <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">"""

new_menu = """                   {/* Dropdown Menu */}
                   {isDropdownOpen && (
                     <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
                       <div className="p-2 border-b border-gray-100 bg-gray-50">
                         <input
                           type="text"
                           placeholder="Search bank..."
                           value={bankSearch}
                           onChange={(e) => setBankSearch(e.target.value)}
                           className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0EB78C]"
                           autoFocus
                         />
                       </div>
                       <div className="overflow-y-auto">"""

content = content.replace(old_menu, new_menu)

# Close div for overflow-y-auto
old_close = """                           </div>
                         ))
                       )}
                     </div>
                   )}"""

new_close = """                           </div>
                         ))
                       )}
                       </div>
                     </div>
                   )}"""

content = content.replace(old_close, new_close)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
