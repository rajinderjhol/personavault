/**
 * Parses Markdown text into HTML elements.
 * @param {string} markdown - The Markdown text to parse.
 * @returns {DocumentFragment} - A DocumentFragment containing the parsed HTML elements.
 */
export function parseMarkdown(markdown) {
    const fragment = document.createDocumentFragment();

    // Split the Markdown text into lines
    const lines = markdown.split('\n');

    lines.forEach(line => {
        if (!line.trim()) {
            // Skip empty lines
            return;
        }

        if (line.startsWith('#')) {
            // Handle headings (e.g., #, ##, ###)
            const level = line.match(/^#+/)[0].length;
            const heading = document.createElement(`h${level}`);
            heading.textContent = line.replace(/^#+\s*/, ''); // Remove Markdown syntax
            fragment.appendChild(heading);
        } else if (line.startsWith('- ')) {
            // Handle unordered lists
            const listItem = document.createElement('li');
            listItem.textContent = line.replace(/^-\s*/, ''); // Remove Markdown syntax
            if (!fragment.lastElementChild || fragment.lastElementChild.tagName !== 'UL') {
                const list = document.createElement('ul');
                fragment.appendChild(list);
            }
            fragment.lastElementChild.appendChild(listItem);
        } else if (line.match(/^\d+\.\s/)) {
            // Handle ordered lists (e.g., 1. item)
            const listItem = document.createElement('li');
            listItem.textContent = line.replace(/^\d+\.\s*/, ''); // Remove Markdown syntax
            if (!fragment.lastElementChild || fragment.lastElementChild.tagName !== 'OL') {
                const list = document.createElement('ol');
                fragment.appendChild(list);
            }
            fragment.lastElementChild.appendChild(listItem);
        } else if (line.startsWith('**') && line.endsWith('**')) {
            // Handle bold text
            const strong = document.createElement('strong');
            strong.textContent = line.slice(2, -2); // Remove Markdown syntax
            fragment.appendChild(strong);
        } else if (line.startsWith('*') && line.endsWith('*')) {
            // Handle italic text
            const em = document.createElement('em');
            em.textContent = line.slice(1, -1); // Remove Markdown syntax
            fragment.appendChild(em);
        } else if (line.match(/\[.*\]\(.*\)/)) {
            // Handle links (e.g., [text](url))
            const linkMatch = line.match(/\[(.*)\]\((.*)\)/);
            if (linkMatch) {
                const link = document.createElement('a');
                link.textContent = linkMatch[1];
                link.href = linkMatch[2];
                link.target = '_blank'; // Open in new tab
                fragment.appendChild(link);
            }
        } else if (line.match(/!\[.*\]\(.*\)/)) {
            // Handle images (e.g., ![alt](url))
            const imageMatch = line.match(/!\[(.*)\]\((.*)\)/);
            if (imageMatch) {
                const image = document.createElement('img');
                image.alt = imageMatch[1];
                image.src = imageMatch[2];
                fragment.appendChild(image);
            }
        } else if (line.startsWith('```')) {
            // Handle code blocks (e.g., ```code```)
            const code = document.createElement('pre');
            code.textContent = line.replace(/^```|```$/g, ''); // Remove Markdown syntax
            fragment.appendChild(code);
        } else {
            // Handle plain text (paragraphs)
            const paragraph = document.createElement('p');
            paragraph.textContent = line;
            fragment.appendChild(paragraph);
        }
    });

    return fragment;
}