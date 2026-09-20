"""
Security and robustness tests for XML parsing in PLIPOracleAdapter.
Verifies defense-in-depth against XML entity expansion (billion laughs),
DTD injections, malformed XML, and anomalous structures using defusedxml.
"""
import os
import tempfile
import pytest
from mocs.ecosystem.backends import PLIPOracleAdapter


@pytest.fixture
def plip_adapter():
    return PLIPOracleAdapter()


def test_parse_valid_plip_xml(plip_adapter, tmp_path):
    """Test 1: Valid PLIP XML parsing extracts interactions properly."""
    valid_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <report>
        <bindingsite>
            <interactions>
                <hydrogen_bonds>
                    <hydrogen_bond id="1">
                        <dist_ha>2.15</dist_ha>
                        <donor>
                            <chain>A</chain>
                            <resname>ASP</resname>
                            <resnr>25</resnr>
                            <atom_name>OD2</atom_name>
                        </donor>
                        <acceptor>
                            <chain>B</chain>
                            <resname>LIG</resname>
                            <resnr>101</resnr>
                            <atom_name>N1</atom_name>
                        </acceptor>
                    </hydrogen_bond>
                </hydrogen_bonds>
            </interactions>
        </bindingsite>
    </report>
    """
    xml_file = tmp_path / "report.xml"
    xml_file.write_text(valid_xml, encoding="utf-8")

    interactions = plip_adapter._parse_plip_xml(str(tmp_path), ligand_id="LIG")
    assert len(interactions) == 1
    hb = interactions[0]
    assert hb.donor_chain == "A"
    assert hb.donor_resname == "ASP"
    assert hb.donor_resseq == 25
    assert hb.donor_atom == "OD2"
    assert hb.acceptor_chain == "B"
    assert hb.acceptor_resname == "LIG"
    assert hb.acceptor_resseq == 101
    assert hb.acceptor_atom == "N1"
    assert abs(hb.distance_angstrom - 2.15) < 1e-4


def test_parse_malformed_xml(plip_adapter, tmp_path):
    """Test 2: Malformed / truncated XML is gracefully handled without crash."""
    malformed_xml = "<report><bindingsite><hydrogen_bond><donor><chain>A"  # Unclosed tags
    xml_file = tmp_path / "corrupt.xml"
    xml_file.write_text(malformed_xml, encoding="utf-8")

    # Should not raise any unhandled exception, returns empty or valid subset
    interactions = plip_adapter._parse_plip_xml(str(tmp_path), ligand_id="LIG")
    assert interactions == []


def test_parse_entity_declaration_blocked(plip_adapter, tmp_path):
    """Test 3: XML with custom DTD entity declarations is blocked by defusedxml."""
    entity_xml = """<?xml version="1.0"?>
    <!DOCTYPE foo [
      <!ENTITY ext "SYSTEM_SECRET">
    ]>
    <report>
        <hydrogen_bond>
            <dist_ha>2.0</dist_ha>
            <donor>
                <chain>&ext;</chain>
                <resname>ASP</resname>
                <resnr>1</resnr>
                <atom_name>N</atom_name>
            </donor>
            <acceptor>
                <chain>B</chain>
                <resname>LIG</resname>
                <resnr>2</resnr>
                <atom_name>O</atom_name>
            </acceptor>
        </hydrogen_bond>
    </report>
    """
    xml_file = tmp_path / "entity.xml"
    xml_file.write_text(entity_xml, encoding="utf-8")

    # defusedxml should refuse entity expansion and drop/skip securely
    interactions = plip_adapter._parse_plip_xml(str(tmp_path), ligand_id="LIG")
    assert interactions == []


def test_parse_billion_laughs_bomb_blocked(plip_adapter, tmp_path):
    """Test 4: Billion laughs exponential entity expansion bomb is blocked."""
    bomb_xml = """<?xml version="1.0"?>
    <!DOCTYPE lolz [
     <!ENTITY lol "lol">
     <!ELEMENT lolz (#PCDATA)>
     <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
     <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
     <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <report>
      <hydrogen_bond>
        <dist_ha>1.5</dist_ha>
        <donor><chain>&lol3;</chain><resname>ALA</resname><resnr>1</resnr><atom_name>N</atom_name></donor>
        <acceptor><chain>B</chain><resname>LIG</resname><resnr>2</resnr><atom_name>O</atom_name></acceptor>
      </hydrogen_bond>
    </report>
    """
    xml_file = tmp_path / "bomb.xml"
    xml_file.write_text(bomb_xml, encoding="utf-8")

    interactions = plip_adapter._parse_plip_xml(str(tmp_path), ligand_id="LIG")
    assert interactions == []


def test_parse_unexpected_xml_structures(plip_adapter, tmp_path):
    """Test 5: Unexpected / incomplete XML structures (missing elements, invalid types) handled cleanly."""
    unexpected_xml = """<?xml version="1.0"?>
    <report>
        <hydrogen_bond>
            <!-- completely empty hydrogen bond element -->
        </hydrogen_bond>
        <hydrogen_bond>
            <!-- donor without acceptor -->
            <donor>
                <chain>A</chain>
                <resnr>invalid_int</resnr>
            </donor>
        </hydrogen_bond>
        <hydrogen_bond>
            <!-- donor and acceptor present but empty / missing fields -->
            <donor/>
            <acceptor/>
            <dist_ha>not_a_float</dist_ha>
        </hydrogen_bond>
        <hydrogen_bond>
            <!-- valid bond mixed in -->
            <dist_ha>2.8</dist_ha>
            <donor><chain>X</chain><resname>TYR</resname><resnr>99</resnr><atom_name>OH</atom_name></donor>
            <acceptor><chain>Y</chain><resname>LIG</resname><resnr>1</resnr><atom_name>O1</atom_name></acceptor>
        </hydrogen_bond>
    </report>
    """
    xml_file = tmp_path / "anomalous.xml"
    xml_file.write_text(unexpected_xml, encoding="utf-8")

    interactions = plip_adapter._parse_plip_xml(str(tmp_path), ligand_id="LIG")
    # Only the valid 4th hydrogen_bond should be extracted; first 3 should be safely skipped
    assert len(interactions) == 1
    assert interactions[0].donor_chain == "X"
    assert interactions[0].donor_resname == "TYR"
    assert interactions[0].donor_resseq == 99
    assert interactions[0].acceptor_resname == "LIG"
    assert abs(interactions[0].distance_angstrom - 2.8) < 1e-4
