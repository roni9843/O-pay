
with open('CryptoPayModal.jsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()
    print('Total backticks:', text.count(chr(96)))
    for i, line in enumerate(text.split('\n')):
        if line.count(chr(96)) % 2 != 0:
            print(f'Line {i+1}: {line}')

